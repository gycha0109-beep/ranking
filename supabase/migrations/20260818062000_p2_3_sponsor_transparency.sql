BEGIN;

CREATE TABLE public.sponsors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (char_length(BTRIM(name)) BETWEEN 1 AND 200),
  slug TEXT NOT NULL UNIQUE CHECK (slug = LOWER(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  website_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.sponsorships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE RESTRICT,
  target_type TEXT NOT NULL CHECK (target_type IN ('ranking', 'item', 'placement')),
  ranking_id UUID REFERENCES public.rankings(id) ON DELETE RESTRICT,
  item_id UUID REFERENCES public.items(id) ON DELETE RESTRICT,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('financial_support', 'product_provided', 'paid_placement', 'affiliate', 'other')),
  disclosure_text TEXT NOT NULL CHECK (char_length(BTRIM(disclosure_text)) BETWEEN 3 AND 2000),
  influence_scope TEXT NOT NULL DEFAULT 'none' CHECK (influence_scope IN ('none', 'candidate_inclusion', 'ranking_order', 'methodology', 'other')),
  influence_note TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  internal_note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sponsorships_target_shape CHECK (
    (target_type = 'ranking' AND ranking_id IS NOT NULL AND item_id IS NULL)
    OR (target_type = 'item' AND ranking_id IS NULL AND item_id IS NOT NULL)
    OR (target_type = 'placement' AND ranking_id IS NOT NULL AND item_id IS NOT NULL)
  ),
  CONSTRAINT sponsorships_period CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT sponsorships_other_influence_note CHECK (
    influence_scope <> 'other' OR char_length(BTRIM(COALESCE(influence_note, ''))) >= 3
  ),
  CONSTRAINT sponsorships_published_timestamp CHECK (
    status <> 'published' OR published_at IS NOT NULL
  )
);

CREATE TABLE public.sponsorship_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('sponsor', 'sponsorship')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'publish', 'archive', 'legacy_reconcile')),
  reason TEXT NOT NULL CHECK (char_length(BTRIM(reason)) BETWEEN 10 AND 2000),
  before_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  after_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sponsors_status_name ON public.sponsors(status, name, id);
CREATE INDEX idx_sponsorships_sponsor ON public.sponsorships(sponsor_id, status, updated_at DESC);
CREATE INDEX idx_sponsorships_ranking ON public.sponsorships(ranking_id, status, starts_at, id) WHERE ranking_id IS NOT NULL;
CREATE INDEX idx_sponsorships_item ON public.sponsorships(item_id, status, starts_at, id) WHERE item_id IS NOT NULL;
CREATE INDEX idx_sponsorship_events_entity ON public.sponsorship_events(entity_type, entity_id, created_at DESC, id DESC);
CREATE INDEX idx_sponsorship_events_actor ON public.sponsorship_events(actor_id, created_at DESC, id DESC) WHERE actor_id IS NOT NULL;

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.sponsors FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.sponsorships FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.sponsorship_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.reject_sponsorship_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION '협찬 감사 원장은 수정하거나 삭제할 수 없습니다.' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER trg_sponsorship_events_immutable
BEFORE UPDATE OR DELETE ON public.sponsorship_events
FOR EACH ROW EXECUTE FUNCTION private.reject_sponsorship_event_mutation();

CREATE OR REPLACE FUNCTION private.touch_sponsor_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sponsors_touch_updated_at
BEFORE UPDATE ON public.sponsors
FOR EACH ROW EXECUTE FUNCTION private.touch_sponsor_updated_at();

CREATE TRIGGER trg_sponsorships_touch_updated_at
BEFORE UPDATE ON public.sponsorships
FOR EACH ROW EXECUTE FUNCTION private.touch_sponsor_updated_at();

CREATE OR REPLACE FUNCTION private.has_admin_capability(p_user_id UUID, p_capability TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_level TEXT;
  v_capability TEXT := LOWER(BTRIM(COALESCE(p_capability, '')));
BEGIN
  IF p_user_id IS NULL THEN RETURN FALSE; END IF;
  v_level := private.get_admin_role_level(p_user_id);

  IF v_capability IN ('admin_console_access', 'moderation_review') THEN
    RETURN v_level IN ('moderator', 'admin', 'super_admin');
  END IF;

  IF v_capability IN (
    'report_review', 'sanction_view', 'sanction_impose_warning', 'content_manage',
    'sanction_impose_restriction', 'appeal_reject', 'audit_view', 'sponsorship_manage'
  ) THEN
    RETURN v_level IN ('admin', 'super_admin');
  END IF;

  IF v_capability IN (
    'sanction_impose_long_suspension', 'sanction_revoke', 'appeal_accept',
    'role_manage', 'audit_sensitive_view', 'security_event_view'
  ) THEN
    RETURN v_level = 'super_admin';
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_admin_access()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_level TEXT;
  v_capabilities JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('role_level', 'none', 'capabilities', '[]'::JSONB);
  END IF;

  v_level := private.get_admin_role_level(v_user_id);
  SELECT COALESCE(jsonb_agg(capability ORDER BY ord), '[]'::JSONB)
  INTO v_capabilities
  FROM (VALUES
    (1, 'admin_console_access'), (2, 'moderation_review'), (3, 'report_review'),
    (4, 'sanction_view'), (5, 'sanction_impose_warning'), (6, 'content_manage'),
    (7, 'sanction_impose_restriction'), (8, 'appeal_reject'), (9, 'audit_view'),
    (10, 'sanction_impose_long_suspension'), (11, 'sanction_revoke'),
    (12, 'appeal_accept'), (13, 'role_manage'), (14, 'audit_sensitive_view'),
    (15, 'security_event_view'), (16, 'sponsorship_manage')
  ) AS capabilities(ord, capability)
  WHERE private.has_admin_capability(v_user_id, capability);

  RETURN jsonb_build_object('role_level', v_level, 'capabilities', v_capabilities);
END;
$$;

CREATE OR REPLACE FUNCTION private.record_sponsorship_event(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_reason TEXT,
  p_before_data JSONB DEFAULT '{}'::JSONB,
  p_after_data JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  PERFORM private.assert_admin_capability('sponsorship_manage');
  IF char_length(BTRIM(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION '변경 사유를 10자 이상 입력해 주세요.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.sponsorship_events(actor_id, entity_type, entity_id, action, reason, before_data, after_data)
  VALUES (auth.uid(), p_entity_type, p_entity_id, p_action, BTRIM(p_reason), COALESCE(p_before_data, '{}'::JSONB), COALESCE(p_after_data, '{}'::JSONB))
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_sponsors()
RETURNS TABLE(
  id UUID, name TEXT, slug TEXT, website_url TEXT, status TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
BEGIN
  PERFORM private.assert_admin_capability('sponsorship_manage');
  RETURN QUERY
  SELECT s.id, s.name, s.slug, s.website_url, s.status, s.created_at, s.updated_at
  FROM public.sponsors s
  ORDER BY (s.status = 'active') DESC, s.name, s.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_sponsor(
  p_name TEXT,
  p_slug TEXT,
  p_website_url TEXT,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_after JSONB;
BEGIN
  PERFORM private.assert_admin_capability('sponsorship_manage');
  INSERT INTO public.sponsors(name, slug, website_url, created_by, updated_by)
  VALUES (BTRIM(p_name), LOWER(BTRIM(p_slug)), NULLIF(BTRIM(COALESCE(p_website_url, '')), ''), auth.uid(), auth.uid())
  RETURNING id, to_jsonb(public.sponsors.*) INTO v_id, v_after;
  PERFORM private.record_sponsorship_event('sponsor', v_id, 'create', p_reason, '{}'::JSONB, v_after);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_sponsor(
  p_id UUID,
  p_name TEXT,
  p_slug TEXT,
  p_website_url TEXT,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
BEGIN
  PERFORM private.assert_admin_capability('sponsorship_manage');
  SELECT to_jsonb(s) INTO v_before FROM public.sponsors s WHERE s.id = p_id FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION '협찬 주체를 찾을 수 없습니다.' USING ERRCODE = 'P0002'; END IF;

  UPDATE public.sponsors
  SET name = BTRIM(p_name), slug = LOWER(BTRIM(p_slug)),
      website_url = NULLIF(BTRIM(COALESCE(p_website_url, '')), ''), updated_by = auth.uid()
  WHERE id = p_id;
  SELECT to_jsonb(s) INTO v_after FROM public.sponsors s WHERE s.id = p_id;
  PERFORM private.record_sponsorship_event('sponsor', p_id, 'update', p_reason, v_before, v_after);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_archive_sponsor(p_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
BEGIN
  PERFORM private.assert_admin_capability('sponsorship_manage');
  SELECT to_jsonb(s) INTO v_before FROM public.sponsors s WHERE s.id = p_id FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION '협찬 주체를 찾을 수 없습니다.' USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (SELECT 1 FROM public.sponsorships sp WHERE sp.sponsor_id = p_id AND sp.status = 'published') THEN
    RAISE EXCEPTION '공개 중인 협찬 관계가 있어 협찬 주체를 보관 처리할 수 없습니다.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.sponsors SET status = 'archived', updated_by = auth.uid() WHERE id = p_id;
  SELECT to_jsonb(s) INTO v_after FROM public.sponsors s WHERE s.id = p_id;
  PERFORM private.record_sponsorship_event('sponsor', p_id, 'archive', p_reason, v_before, v_after);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_sponsorships()
RETURNS TABLE(
  id UUID, sponsor_id UUID, sponsor_name TEXT, target_type TEXT,
  ranking_id UUID, ranking_title TEXT, item_id UUID, item_title TEXT,
  relationship_type TEXT, disclosure_text TEXT, influence_scope TEXT, influence_note TEXT,
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, status TEXT, published_at TIMESTAMPTZ,
  internal_note TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
BEGIN
  PERFORM private.assert_admin_capability('sponsorship_manage');
  RETURN QUERY
  SELECT sp.id, sp.sponsor_id, s.name, sp.target_type,
         sp.ranking_id, r.title, sp.item_id, i.title,
         sp.relationship_type, sp.disclosure_text, sp.influence_scope, sp.influence_note,
         sp.starts_at, sp.ends_at, sp.status, sp.published_at,
         sp.internal_note, sp.created_at, sp.updated_at
  FROM public.sponsorships sp
  JOIN public.sponsors s ON s.id = sp.sponsor_id
  LEFT JOIN public.rankings r ON r.id = sp.ranking_id
  LEFT JOIN public.items i ON i.id = sp.item_id
  ORDER BY sp.updated_at DESC, sp.id DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_sponsorship(
  p_sponsor_id UUID,
  p_target_type TEXT,
  p_ranking_id UUID,
  p_item_id UUID,
  p_relationship_type TEXT,
  p_disclosure_text TEXT,
  p_influence_scope TEXT,
  p_influence_note TEXT,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_internal_note TEXT,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_after JSONB;
BEGIN
  PERFORM private.assert_admin_capability('sponsorship_manage');
  INSERT INTO public.sponsorships(
    sponsor_id, target_type, ranking_id, item_id, relationship_type,
    disclosure_text, influence_scope, influence_note, starts_at, ends_at,
    internal_note, created_by, updated_by
  ) VALUES (
    p_sponsor_id, LOWER(BTRIM(p_target_type)), p_ranking_id, p_item_id, LOWER(BTRIM(p_relationship_type)),
    BTRIM(p_disclosure_text), LOWER(BTRIM(p_influence_scope)), NULLIF(BTRIM(COALESCE(p_influence_note, '')), ''),
    p_starts_at, p_ends_at, NULLIF(BTRIM(COALESCE(p_internal_note, '')), ''), auth.uid(), auth.uid()
  ) RETURNING id, to_jsonb(public.sponsorships.*) INTO v_id, v_after;
  PERFORM private.record_sponsorship_event('sponsorship', v_id, 'create', p_reason, '{}'::JSONB, v_after);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_sponsorship(
  p_id UUID,
  p_sponsor_id UUID,
  p_target_type TEXT,
  p_ranking_id UUID,
  p_item_id UUID,
  p_relationship_type TEXT,
  p_disclosure_text TEXT,
  p_influence_scope TEXT,
  p_influence_note TEXT,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_internal_note TEXT,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
BEGIN
  PERFORM private.assert_admin_capability('sponsorship_manage');
  SELECT to_jsonb(sp) INTO v_before FROM public.sponsorships sp WHERE sp.id = p_id FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION '협찬 관계를 찾을 수 없습니다.' USING ERRCODE = 'P0002'; END IF;
  IF v_before->>'status' <> 'draft' THEN
    RAISE EXCEPTION '공개 또는 보관된 협찬 관계는 직접 수정할 수 없습니다. 보관 후 새 관계를 생성해 주세요.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.sponsorships
  SET sponsor_id = p_sponsor_id, target_type = LOWER(BTRIM(p_target_type)),
      ranking_id = p_ranking_id, item_id = p_item_id,
      relationship_type = LOWER(BTRIM(p_relationship_type)), disclosure_text = BTRIM(p_disclosure_text),
      influence_scope = LOWER(BTRIM(p_influence_scope)), influence_note = NULLIF(BTRIM(COALESCE(p_influence_note, '')), ''),
      starts_at = p_starts_at, ends_at = p_ends_at,
      internal_note = NULLIF(BTRIM(COALESCE(p_internal_note, '')), ''), updated_by = auth.uid()
  WHERE id = p_id;
  SELECT to_jsonb(sp) INTO v_after FROM public.sponsorships sp WHERE sp.id = p_id;
  PERFORM private.record_sponsorship_event('sponsorship', p_id, 'update', p_reason, v_before, v_after);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_publish_sponsorship(p_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_row public.sponsorships%ROWTYPE;
  v_before JSONB;
  v_after JSONB;
BEGIN
  PERFORM private.assert_admin_capability('sponsorship_manage');
  SELECT * INTO v_row FROM public.sponsorships WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '협찬 관계를 찾을 수 없습니다.' USING ERRCODE = 'P0002'; END IF;
  IF v_row.status <> 'draft' THEN RAISE EXCEPTION '초안 상태의 협찬 관계만 공개할 수 있습니다.' USING ERRCODE = '23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sponsors s WHERE s.id = v_row.sponsor_id AND s.status = 'active') THEN
    RAISE EXCEPTION '활성 협찬 주체만 공개할 수 있습니다.' USING ERRCODE = '23514';
  END IF;
  IF v_row.target_type = 'placement' AND NOT EXISTS (
    SELECT 1 FROM public.ranking_entries re WHERE re.ranking_id = v_row.ranking_id AND re.item_id = v_row.item_id
  ) THEN
    RAISE EXCEPTION '현재 랭킹에 존재하지 않는 아이템 배치는 공개할 수 없습니다.' USING ERRCODE = '23514';
  END IF;

  v_before := to_jsonb(v_row);
  UPDATE public.sponsorships
  SET status = 'published', published_at = NOW(), updated_by = auth.uid()
  WHERE id = p_id;
  SELECT to_jsonb(sp) INTO v_after FROM public.sponsorships sp WHERE sp.id = p_id;
  PERFORM private.record_sponsorship_event('sponsorship', p_id, 'publish', p_reason, v_before, v_after);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_archive_sponsorship(p_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
BEGIN
  PERFORM private.assert_admin_capability('sponsorship_manage');
  SELECT to_jsonb(sp) INTO v_before FROM public.sponsorships sp WHERE sp.id = p_id FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION '협찬 관계를 찾을 수 없습니다.' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.sponsorships SET status = 'archived', updated_by = auth.uid() WHERE id = p_id;
  SELECT to_jsonb(sp) INTO v_after FROM public.sponsorships sp WHERE sp.id = p_id;
  PERFORM private.record_sponsorship_event('sponsorship', p_id, 'archive', p_reason, v_before, v_after);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_sponsorship_events(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  id UUID, actor_id UUID, actor_label TEXT, entity_type TEXT, entity_id UUID,
  action TEXT, reason TEXT, before_data JSONB, after_data JSONB, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
BEGIN
  PERFORM private.assert_admin_capability('audit_view');
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION '감사 조회 개수는 1개 이상 100개 이하이어야 합니다.' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT e.id, e.actor_id,
         COALESCE(p.display_name, CASE WHEN e.actor_id IS NULL THEN '시스템' ELSE e.actor_id::TEXT END),
         e.entity_type, e.entity_id, e.action, e.reason,
         e.before_data - 'internal_note' - 'created_by' - 'updated_by',
         e.after_data - 'internal_note' - 'created_by' - 'updated_by', e.created_at
  FROM public.sponsorship_events e
  LEFT JOIN public.profiles p ON p.id = e.actor_id
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_ranking_sponsorship_disclosures(p_ranking_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', sp.id,
    'sponsor_name', s.name,
    'sponsor_website_url', s.website_url,
    'target_type', sp.target_type,
    'ranking_id', sp.ranking_id,
    'item_id', sp.item_id,
    'relationship_type', sp.relationship_type,
    'disclosure_text', sp.disclosure_text,
    'influence_scope', sp.influence_scope,
    'influence_note', sp.influence_note,
    'starts_at', sp.starts_at,
    'ends_at', sp.ends_at,
    'published_at', sp.published_at
  ) ORDER BY sp.starts_at DESC, sp.id), '[]'::JSONB)
  FROM public.sponsorships sp
  JOIN public.sponsors s ON s.id = sp.sponsor_id
  JOIN public.rankings r ON r.id = sp.ranking_id AND r.status = 'published'
  WHERE sp.ranking_id = p_ranking_id
    AND sp.target_type IN ('ranking', 'placement')
    AND sp.status = 'published';
$$;

CREATE OR REPLACE FUNCTION public.get_public_item_sponsorship_disclosures(p_item_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', sp.id,
    'sponsor_name', s.name,
    'sponsor_website_url', s.website_url,
    'target_type', sp.target_type,
    'item_id', sp.item_id,
    'relationship_type', sp.relationship_type,
    'disclosure_text', sp.disclosure_text,
    'influence_scope', sp.influence_scope,
    'influence_note', sp.influence_note,
    'starts_at', sp.starts_at,
    'ends_at', sp.ends_at,
    'published_at', sp.published_at
  ) ORDER BY sp.starts_at DESC, sp.id), '[]'::JSONB)
  FROM public.sponsorships sp
  JOIN public.sponsors s ON s.id = sp.sponsor_id
  JOIN public.items i ON i.id = sp.item_id AND i.status = 'active'
  WHERE sp.item_id = p_item_id
    AND sp.target_type = 'item'
    AND sp.status = 'published';
$$;

CREATE OR REPLACE FUNCTION private.enforce_sponsored_ranking_disclosure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.ranking_type = 'sponsored' AND NOT EXISTS (
    SELECT 1 FROM public.sponsorships sp
    WHERE sp.target_type = 'ranking' AND sp.ranking_id = NEW.id AND sp.status = 'published'
  ) THEN
    RAISE EXCEPTION '스폰서십 랭킹은 공개된 랭킹 단위 협찬 관계가 필요합니다.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rankings_require_sponsorship_disclosure
BEFORE INSERT OR UPDATE OF status, ranking_type ON public.rankings
FOR EACH ROW EXECUTE FUNCTION private.enforce_sponsored_ranking_disclosure();

CREATE OR REPLACE FUNCTION private.reject_legacy_sponsor_flag_true()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.sponsor_flag IS TRUE THEN
    RAISE EXCEPTION 'legacy sponsor_flag는 더 이상 협찬 truth로 작성할 수 없습니다.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ranking_entries_reject_legacy_sponsor_flag
BEFORE INSERT OR UPDATE OF sponsor_flag ON public.ranking_entries
FOR EACH ROW EXECUTE FUNCTION private.reject_legacy_sponsor_flag_true();

CREATE OR REPLACE FUNCTION public.save_ranking_e2e(
  p_ranking_id UUID,
  p_ranking_data JSONB,
  p_criteria JSONB,
  p_sources JSONB,
  p_entries JSONB,
  p_facet_ids UUID[],
  p_expected_updated_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_current_status TEXT;
  v_current_updated_at TIMESTAMPTZ;
  v_new_updated_at TIMESTAMPTZ;
  v_was_published BOOLEAN;
  v_category_id UUID;
  v_subcategory_id UUID;
  v_entry_count INTEGER;
  v_distinct_positions INTEGER;
  v_distinct_items INTEGER;
BEGIN
  PERFORM private.assert_admin_capability('content_manage');

  IF jsonb_typeof(p_ranking_data) <> 'object'
     OR jsonb_typeof(p_criteria) <> 'array'
     OR jsonb_typeof(p_sources) <> 'array'
     OR jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION '잘못된 저장 payload 형식입니다.' USING ERRCODE = '22023';
  END IF;

  SELECT status, updated_at INTO v_current_status, v_current_updated_at
  FROM public.rankings WHERE id = p_ranking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '랭킹을 찾을 수 없습니다.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_updated_at IS NULL OR v_current_updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION '랭킹이 다른 세션에서 변경되었습니다.' USING ERRCODE = '40001';
  END IF;

  v_was_published := v_current_status = 'published';
  v_category_id := NULLIF(p_ranking_data->>'category_id', '')::UUID;
  v_subcategory_id := NULLIF(p_ranking_data->>'subcategory_id', '')::UUID;

  IF v_category_id IS NULL OR BTRIM(COALESCE(p_ranking_data->>'title', '')) = ''
     OR BTRIM(COALESCE(p_ranking_data->>'slug', '')) = '' OR BTRIM(COALESCE(p_ranking_data->>'summary', '')) = ''
     OR BTRIM(COALESCE(p_ranking_data->>'ranking_type', '')) = '' THEN
    RAISE EXCEPTION '랭킹 필수 입력값이 누락되었습니다.' USING ERRCODE = '23502';
  END IF;
  IF BTRIM(COALESCE(p_ranking_data#>>'{scope_json,target}', '')) = ''
     OR BTRIM(COALESCE(p_ranking_data#>>'{scope_json,period}', '')) = ''
     OR BTRIM(COALESCE(p_ranking_data#>>'{scope_json,method}', '')) = '' THEN
    RAISE EXCEPTION '후보군 범위 정보가 누락되었습니다.' USING ERRCODE = '23514';
  END IF;
  IF v_subcategory_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subcategories WHERE id = v_subcategory_id AND category_id = v_category_id
  ) THEN RAISE EXCEPTION '카테고리와 서브카테고리 관계가 올바르지 않습니다.' USING ERRCODE = '23514'; END IF;
  IF jsonb_array_length(p_criteria) < 1 THEN RAISE EXCEPTION '평가 기준이 최소 1개 필요합니다.' USING ERRCODE = '23514'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_criteria) AS c(name TEXT, sort_order INTEGER)
    WHERE BTRIM(COALESCE(c.name, '')) = '' OR c.sort_order IS NULL OR c.sort_order < 0
  ) THEN RAISE EXCEPTION '평가 기준 값이 올바르지 않습니다.' USING ERRCODE = '23514'; END IF;

  SELECT COUNT(*), COUNT(DISTINCT e.position), COUNT(DISTINCT e.item_id)
  INTO v_entry_count, v_distinct_positions, v_distinct_items
  FROM jsonb_to_recordset(p_entries) AS e(item_id UUID, position INTEGER, reason TEXT);
  IF v_entry_count < 1 THEN RAISE EXCEPTION '순위 항목이 최소 1개 필요합니다.' USING ERRCODE = '23514'; END IF;
  IF v_entry_count <> v_distinct_positions OR v_entry_count <> v_distinct_items THEN
    RAISE EXCEPTION '중복된 순위 또는 아이템이 있습니다.' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_entries) AS e(item_id UUID, position INTEGER, reason TEXT)
    WHERE e.item_id IS NULL OR e.position IS NULL OR e.position < 1 OR BTRIM(COALESCE(e.reason, '')) = ''
  ) THEN RAISE EXCEPTION '순위 항목 값이 올바르지 않습니다.' USING ERRCODE = '23514'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_entries) AS e(item_id UUID)
    LEFT JOIN public.items i ON i.id = e.item_id WHERE i.id IS NULL
  ) THEN RAISE EXCEPTION '존재하지 않는 아이템이 포함되어 있습니다.' USING ERRCODE = '23503'; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sponsorships sp
    WHERE sp.target_type = 'placement' AND sp.ranking_id = p_ranking_id AND sp.status = 'published'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_entries) AS e(item_id UUID) WHERE e.item_id = sp.item_id
      )
  ) THEN
    RAISE EXCEPTION '공개 중인 협찬 배치가 있는 아이템은 랭킹 저장으로 제거할 수 없습니다. 먼저 협찬 관계를 보관 처리해 주세요.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM UNNEST(COALESCE(p_facet_ids, ARRAY[]::UUID[])) AS requested_facet_id
    LEFT JOIN public.facets f ON f.id = requested_facet_id WHERE f.id IS NULL
  ) THEN RAISE EXCEPTION '존재하지 않는 페이셋이 포함되어 있습니다.' USING ERRCODE = '23503'; END IF;
  IF CARDINALITY(COALESCE(p_facet_ids, ARRAY[]::UUID[])) <>
     (SELECT COUNT(DISTINCT facet_id) FROM UNNEST(COALESCE(p_facet_ids, ARRAY[]::UUID[])) AS facet_id) THEN
    RAISE EXCEPTION '중복된 페이셋이 포함되어 있습니다.' USING ERRCODE = '23505';
  END IF;

  UPDATE public.rankings
  SET category_id = v_category_id, subcategory_id = v_subcategory_id,
      title = BTRIM(p_ranking_data->>'title'), slug = LOWER(BTRIM(p_ranking_data->>'slug')),
      summary = BTRIM(p_ranking_data->>'summary'), body = NULLIF(p_ranking_data->>'body', ''),
      ranking_type = p_ranking_data->>'ranking_type', scope_json = COALESCE(p_ranking_data->'scope_json', '{}'::JSONB),
      featured = COALESCE((p_ranking_data->>'featured')::BOOLEAN, FALSE),
      cover_image_url = NULLIF(p_ranking_data->>'cover_image_url', ''), seo_title = NULLIF(p_ranking_data->>'seo_title', ''),
      seo_description = NULLIF(p_ranking_data->>'seo_description', ''),
      moderation_status = COALESCE(NULLIF(p_ranking_data->>'moderation_status', ''), 'needs_review'),
      moderation_reason = COALESCE(NULLIF(p_ranking_data->>'moderation_reason', ''), 'system_error'),
      moderation_reviewed_by = NULL, moderation_reviewed_at = NULL, moderation_review_note = NULL,
      status = 'draft', published_at = NULL, updated_by = auth.uid()
  WHERE id = p_ranking_id RETURNING updated_at INTO v_new_updated_at;

  DELETE FROM public.ranking_criteria WHERE ranking_id = p_ranking_id;
  INSERT INTO public.ranking_criteria(ranking_id, name, description, weight, sort_order)
  SELECT p_ranking_id, BTRIM(c.name), NULLIF(c.description, ''), c.weight, c.sort_order
  FROM jsonb_to_recordset(p_criteria) AS c(name TEXT, description TEXT, weight NUMERIC, sort_order INTEGER);

  DELETE FROM public.ranking_sources WHERE ranking_id = p_ranking_id;
  INSERT INTO public.ranking_sources(ranking_id, label, url, source_type, note, is_public)
  SELECT p_ranking_id, BTRIM(s.label), NULLIF(s.url, ''), NULLIF(s.source_type, ''), NULLIF(s.note, ''), COALESCE(s.is_public, TRUE)
  FROM jsonb_to_recordset(p_sources) AS s(label TEXT, url TEXT, source_type TEXT, note TEXT, is_public BOOLEAN)
  WHERE BTRIM(COALESCE(s.label, '')) <> '';

  DELETE FROM public.ranking_entries WHERE ranking_id = p_ranking_id;
  INSERT INTO public.ranking_entries(
    ranking_id, item_id, position, reason, editor_score, score_json, internal_note,
    sponsor_flag, moderation_status, moderation_reason, moderation_reviewed_by,
    moderation_reviewed_at, moderation_review_note
  )
  SELECT p_ranking_id, e.item_id, e.position, BTRIM(e.reason), e.editor_score,
         COALESCE(e.score_json, '{}'::JSONB), NULLIF(e.internal_note, ''), FALSE,
         COALESCE(NULLIF(e.moderation_status, ''), 'needs_review'),
         COALESCE(NULLIF(e.moderation_reason, ''), 'system_error'), NULL, NULL, NULL
  FROM jsonb_to_recordset(p_entries) AS e(
    item_id UUID, position INTEGER, reason TEXT, editor_score NUMERIC,
    score_json JSONB, internal_note TEXT, moderation_status TEXT, moderation_reason TEXT
  );

  DELETE FROM public.ranking_facets WHERE ranking_id = p_ranking_id;
  INSERT INTO public.ranking_facets(ranking_id, facet_id)
  SELECT p_ranking_id, facet_id FROM UNNEST(COALESCE(p_facet_ids, ARRAY[]::UUID[])) AS facet_id;

  RETURN JSONB_BUILD_OBJECT('ranking_id', p_ranking_id, 'status', 'draft', 'was_published', v_was_published, 'updated_at', v_new_updated_at);
END;
$$;

DO $$
DECLARE
  v_flag_count INTEGER;
  v_target_count INTEGER;
  v_entry RECORD;
BEGIN
  SELECT COUNT(*) INTO v_flag_count FROM public.ranking_entries WHERE sponsor_flag IS TRUE;
  SELECT COUNT(*) INTO v_target_count
  FROM public.ranking_entries re
  JOIN public.rankings r ON r.id = re.ranking_id
  JOIN public.items i ON i.id = re.item_id
  WHERE re.sponsor_flag IS TRUE AND r.slug = 'best-chicken-breast' AND i.slug = 'hankki-grill-sous-vide';

  IF v_flag_count <> 1 OR v_target_count <> 1 THEN
    RAISE EXCEPTION 'legacy sponsor flag prestate가 승인된 테스트 데이터 1건과 일치하지 않습니다.' USING ERRCODE = '23514';
  END IF;

  SELECT re.id, re.ranking_id, re.item_id INTO v_entry
  FROM public.ranking_entries re
  JOIN public.rankings r ON r.id = re.ranking_id
  JOIN public.items i ON i.id = re.item_id
  WHERE re.sponsor_flag IS TRUE AND r.slug = 'best-chicken-breast' AND i.slug = 'hankki-grill-sous-vide'
  FOR UPDATE OF re;

  INSERT INTO public.sponsorship_events(actor_id, entity_type, entity_id, action, reason, before_data, after_data)
  VALUES (
    NULL, 'sponsorship', v_entry.id, 'legacy_reconcile',
    '운영자 확인에 따라 테스트/더미로 생성된 legacy sponsor_flag를 실제 협찬 관계로 이관하지 않고 제거했습니다.',
    jsonb_build_object('ranking_id', v_entry.ranking_id, 'item_id', v_entry.item_id, 'ranking_entry_id', v_entry.id, 'sponsor_flag', TRUE),
    jsonb_build_object('ranking_id', v_entry.ranking_id, 'item_id', v_entry.item_id, 'ranking_entry_id', v_entry.id, 'sponsor_flag', FALSE)
  );

  UPDATE public.ranking_entries SET sponsor_flag = FALSE WHERE id = v_entry.id;

  IF EXISTS (SELECT 1 FROM public.ranking_entries WHERE sponsor_flag IS TRUE) THEN
    RAISE EXCEPTION '미해결 legacy sponsor flag가 남아 있습니다.' USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.reject_sponsorship_event_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.touch_sponsor_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.record_sponsorship_event(TEXT, UUID, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enforce_sponsored_ranking_disclosure() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reject_legacy_sponsor_flag_true() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_list_sponsors() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_sponsor(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_sponsor(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_archive_sponsor(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_sponsorships() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_sponsorship(UUID, TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_sponsorship(UUID, UUID, TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_publish_sponsorship(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_archive_sponsorship(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_sponsorship_events(INTEGER) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_list_sponsors() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_sponsor(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_sponsor(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_archive_sponsor(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_sponsorships() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_sponsorship(UUID, TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_sponsorship(UUID, UUID, TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_sponsorship(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_archive_sponsorship(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_sponsorship_events(INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.get_public_ranking_sponsorship_disclosures(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_item_sponsorship_disclosures(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_ranking_sponsorship_disclosures(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_item_sponsorship_disclosures(UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.save_ranking_e2e(UUID, JSONB, JSONB, JSONB, JSONB, UUID[], TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_ranking_e2e(UUID, JSONB, JSONB, JSONB, JSONB, UUID[], TIMESTAMPTZ) TO authenticated;

COMMIT;
