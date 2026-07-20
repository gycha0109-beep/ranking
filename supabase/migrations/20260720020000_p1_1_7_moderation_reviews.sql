BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

ALTER TABLE public.rankings
  ADD COLUMN IF NOT EXISTS image_moderation_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_moderation_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS image_moderation_review_note TEXT;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS image_moderation_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_moderation_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS image_moderation_review_note TEXT;

CREATE TABLE IF NOT EXISTS public.moderation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (
    entity_type IN (
      'ranking',
      'ranking_entry',
      'item',
      'ranking_image',
      'item_image',
      'comment'
    )
  ),
  entity_id UUID NOT NULL,
  previous_status TEXT NOT NULL CHECK (
    previous_status IN ('clean', 'suggestive', 'needs_review', 'blocked')
  ),
  previous_reason TEXT NOT NULL CHECK (
    previous_reason IN (
      'sexual_suggestive',
      'explicit_sexual',
      'minor_sexualization',
      'real_person_sexualization',
      'hate',
      'violence',
      'privacy',
      'illegal',
      'spam',
      'none',
      'system_error'
    )
  ),
  decision_status TEXT NOT NULL CHECK (
    decision_status IN ('clean', 'suggestive', 'needs_review', 'blocked')
  ),
  decision_reason TEXT NOT NULL CHECK (
    decision_reason IN (
      'sexual_suggestive',
      'explicit_sexual',
      'minor_sexualization',
      'real_person_sexualization',
      'hate',
      'violence',
      'privacy',
      'illegal',
      'spam',
      'none',
      'system_error'
    )
  ),
  review_note TEXT,
  decision_source TEXT NOT NULL CHECK (decision_source IN ('automated', 'manual')),
  matched_term_id UUID REFERENCES public.moderation_terms(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.moderation_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view moderation reviews" ON public.moderation_reviews;
CREATE POLICY "Admins can view moderation reviews"
ON public.moderation_reviews
FOR SELECT
USING (public.is_admin());

REVOKE ALL ON TABLE public.moderation_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.moderation_reviews TO authenticated;

CREATE INDEX IF NOT EXISTS idx_moderation_reviews_entity
  ON public.moderation_reviews (entity_type, entity_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_reviews_reviewer
  ON public.moderation_reviews (reviewed_by, reviewed_at DESC);

CREATE OR REPLACE FUNCTION private.prevent_moderation_review_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, private, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'moderation_reviews is append-only'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_moderation_reviews_append_only ON public.moderation_reviews;
CREATE TRIGGER trg_moderation_reviews_append_only
BEFORE UPDATE OR DELETE ON public.moderation_reviews
FOR EACH ROW
EXECUTE FUNCTION private.prevent_moderation_review_mutation();

CREATE OR REPLACE FUNCTION private.apply_moderation_review(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_decision_status TEXT,
  p_decision_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_previous_status TEXT;
  v_previous_reason TEXT;
  v_note TEXT := NULLIF(BTRIM(COALESCE(p_note, '')), '');
  v_decision_reason TEXT := COALESCE(NULLIF(BTRIM(p_decision_reason), ''), 'none');
  v_reviewed_at TIMESTAMPTZ := NOW();
BEGIN
  IF v_user_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.'
      USING ERRCODE = '42501';
  END IF;

  IF p_entity_type NOT IN (
    'ranking',
    'ranking_entry',
    'item',
    'ranking_image',
    'item_image',
    'comment'
  ) THEN
    RAISE EXCEPTION '지원하지 않는 Moderation 대상입니다.'
      USING ERRCODE = '22023';
  END IF;

  IF p_decision_status NOT IN ('clean', 'suggestive', 'needs_review', 'blocked') THEN
    RAISE EXCEPTION '유효하지 않은 Moderation 상태입니다.'
      USING ERRCODE = '22023';
  END IF;

  IF v_decision_reason NOT IN (
    'sexual_suggestive',
    'explicit_sexual',
    'minor_sexualization',
    'real_person_sexualization',
    'hate',
    'violence',
    'privacy',
    'illegal',
    'spam',
    'none',
    'system_error'
  ) THEN
    RAISE EXCEPTION '유효하지 않은 Moderation 사유입니다.'
      USING ERRCODE = '22023';
  END IF;

  IF p_decision_status = 'clean' THEN
    v_decision_reason := 'none';
  END IF;

  CASE p_entity_type
    WHEN 'ranking' THEN
      SELECT moderation_status, moderation_reason
      INTO v_previous_status, v_previous_reason
      FROM public.rankings
      WHERE id = p_entity_id
      FOR UPDATE;

    WHEN 'ranking_entry' THEN
      SELECT moderation_status, moderation_reason
      INTO v_previous_status, v_previous_reason
      FROM public.ranking_entries
      WHERE id = p_entity_id
      FOR UPDATE;

    WHEN 'item' THEN
      SELECT moderation_status, moderation_reason
      INTO v_previous_status, v_previous_reason
      FROM public.items
      WHERE id = p_entity_id
      FOR UPDATE;

    WHEN 'ranking_image' THEN
      SELECT image_moderation_status, image_moderation_reason
      INTO v_previous_status, v_previous_reason
      FROM public.rankings
      WHERE id = p_entity_id
      FOR UPDATE;

    WHEN 'item_image' THEN
      SELECT image_moderation_status, image_moderation_reason
      INTO v_previous_status, v_previous_reason
      FROM public.items
      WHERE id = p_entity_id
      FOR UPDATE;

    WHEN 'comment' THEN
      SELECT moderation_status, moderation_reason
      INTO v_previous_status, v_previous_reason
      FROM public.comments
      WHERE id = p_entity_id
      FOR UPDATE;
  END CASE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Moderation 대상을 찾을 수 없습니다.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_previous_status = p_decision_status AND v_note IS NULL THEN
    RAISE EXCEPTION '동일 상태 재검토에는 검토 메모가 필요합니다.'
      USING ERRCODE = '22023';
  END IF;

  IF v_previous_status = 'blocked'
     AND p_decision_status IN ('clean', 'suggestive')
     AND COALESCE(LENGTH(v_note), 0) < 10 THEN
    RAISE EXCEPTION '차단 해제에는 10자 이상의 검토 메모가 필요합니다.'
      USING ERRCODE = '22023';
  END IF;

  CASE p_entity_type
    WHEN 'ranking' THEN
      UPDATE public.rankings
      SET moderation_status = p_decision_status,
          moderation_reason = v_decision_reason,
          moderation_reviewed_by = v_user_id,
          moderation_reviewed_at = v_reviewed_at,
          moderation_review_note = v_note
      WHERE id = p_entity_id;

    WHEN 'ranking_entry' THEN
      UPDATE public.ranking_entries
      SET moderation_status = p_decision_status,
          moderation_reason = v_decision_reason,
          moderation_reviewed_by = v_user_id,
          moderation_reviewed_at = v_reviewed_at,
          moderation_review_note = v_note
      WHERE id = p_entity_id;

    WHEN 'item' THEN
      UPDATE public.items
      SET moderation_status = p_decision_status,
          moderation_reason = v_decision_reason,
          moderation_reviewed_by = v_user_id,
          moderation_reviewed_at = v_reviewed_at,
          moderation_review_note = v_note
      WHERE id = p_entity_id;

    WHEN 'ranking_image' THEN
      UPDATE public.rankings
      SET image_moderation_status = p_decision_status,
          image_moderation_reason = v_decision_reason,
          image_moderation_reviewed_by = v_user_id,
          image_moderation_reviewed_at = v_reviewed_at,
          image_moderation_review_note = v_note
      WHERE id = p_entity_id;

    WHEN 'item_image' THEN
      UPDATE public.items
      SET image_moderation_status = p_decision_status,
          image_moderation_reason = v_decision_reason,
          image_moderation_reviewed_by = v_user_id,
          image_moderation_reviewed_at = v_reviewed_at,
          image_moderation_review_note = v_note
      WHERE id = p_entity_id;

    WHEN 'comment' THEN
      UPDATE public.comments
      SET moderation_status = p_decision_status,
          moderation_reason = v_decision_reason,
          moderation_reviewed_by = v_user_id,
          moderation_reviewed_at = v_reviewed_at,
          moderation_review_note = v_note
      WHERE id = p_entity_id;
  END CASE;

  INSERT INTO public.moderation_reviews (
    entity_type,
    entity_id,
    previous_status,
    previous_reason,
    decision_status,
    decision_reason,
    review_note,
    decision_source,
    reviewed_by,
    reviewed_at
  )
  VALUES (
    p_entity_type,
    p_entity_id,
    v_previous_status,
    v_previous_reason,
    p_decision_status,
    v_decision_reason,
    v_note,
    'manual',
    v_user_id,
    v_reviewed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION private.apply_moderation_review(TEXT, UUID, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.review_ranking_moderation(
  p_ranking_id UUID,
  p_decision_status TEXT,
  p_decision_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.apply_moderation_review(
    'ranking',
    p_ranking_id,
    p_decision_status,
    p_decision_reason,
    p_note
  );
$$;

CREATE OR REPLACE FUNCTION public.review_ranking_entry_moderation(
  p_entry_id UUID,
  p_decision_status TEXT,
  p_decision_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.apply_moderation_review(
    'ranking_entry',
    p_entry_id,
    p_decision_status,
    p_decision_reason,
    p_note
  );
$$;

CREATE OR REPLACE FUNCTION public.review_item_moderation(
  p_item_id UUID,
  p_decision_status TEXT,
  p_decision_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.apply_moderation_review(
    'item',
    p_item_id,
    p_decision_status,
    p_decision_reason,
    p_note
  );
$$;

CREATE OR REPLACE FUNCTION public.review_ranking_image_moderation(
  p_ranking_id UUID,
  p_decision_status TEXT,
  p_decision_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.apply_moderation_review(
    'ranking_image',
    p_ranking_id,
    p_decision_status,
    p_decision_reason,
    p_note
  );
$$;

CREATE OR REPLACE FUNCTION public.review_item_image_moderation(
  p_item_id UUID,
  p_decision_status TEXT,
  p_decision_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.apply_moderation_review(
    'item_image',
    p_item_id,
    p_decision_status,
    p_decision_reason,
    p_note
  );
$$;

CREATE OR REPLACE FUNCTION public.review_comment_moderation(
  p_comment_id UUID,
  p_decision_status TEXT,
  p_decision_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.apply_moderation_review(
    'comment',
    p_comment_id,
    p_decision_status,
    p_decision_reason,
    p_note
  );
$$;

REVOKE ALL ON FUNCTION public.review_ranking_moderation(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_ranking_entry_moderation(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_item_moderation(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_ranking_image_moderation(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_item_image_moderation(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_comment_moderation(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.review_ranking_moderation(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_ranking_entry_moderation(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_item_moderation(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_ranking_image_moderation(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_item_image_moderation(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_comment_moderation(UUID, TEXT, TEXT, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.approve_ranking_moderation(UUID, TEXT);

CREATE OR REPLACE FUNCTION private.set_ranking_image_moderation_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NULLIF(BTRIM(COALESCE(NEW.cover_image_url, '')), '') IS NULL THEN
      NEW.image_moderation_status := 'clean';
      NEW.image_moderation_reason := 'none';
    ELSE
      NEW.image_moderation_status := 'needs_review';
      NEW.image_moderation_reason := 'none';
    END IF;

    NEW.image_moderation_reviewed_by := NULL;
    NEW.image_moderation_reviewed_at := NULL;
    NEW.image_moderation_review_note := NULL;
  ELSIF NEW.cover_image_url IS DISTINCT FROM OLD.cover_image_url THEN
    IF NULLIF(BTRIM(COALESCE(NEW.cover_image_url, '')), '') IS NULL THEN
      NEW.image_moderation_status := 'clean';
      NEW.image_moderation_reason := 'none';
    ELSE
      NEW.image_moderation_status := 'needs_review';
      NEW.image_moderation_reason := 'none';
    END IF;

    NEW.image_moderation_reviewed_by := NULL;
    NEW.image_moderation_reviewed_at := NULL;
    NEW.image_moderation_review_note := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rankings_image_moderation_state ON public.rankings;
CREATE TRIGGER trg_rankings_image_moderation_state
BEFORE INSERT OR UPDATE OF cover_image_url ON public.rankings
FOR EACH ROW
EXECUTE FUNCTION private.set_ranking_image_moderation_state();

CREATE OR REPLACE FUNCTION private.set_item_image_moderation_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NULLIF(BTRIM(COALESCE(NEW.image_url, '')), '') IS NULL THEN
      NEW.image_moderation_status := 'clean';
      NEW.image_moderation_reason := 'none';
    ELSE
      NEW.image_moderation_status := 'needs_review';
      NEW.image_moderation_reason := 'none';
    END IF;

    NEW.image_moderation_reviewed_by := NULL;
    NEW.image_moderation_reviewed_at := NULL;
    NEW.image_moderation_review_note := NULL;
  ELSIF NEW.image_url IS DISTINCT FROM OLD.image_url THEN
    IF NULLIF(BTRIM(COALESCE(NEW.image_url, '')), '') IS NULL THEN
      NEW.image_moderation_status := 'clean';
      NEW.image_moderation_reason := 'none';
    ELSE
      NEW.image_moderation_status := 'needs_review';
      NEW.image_moderation_reason := 'none';
    END IF;

    NEW.image_moderation_reviewed_by := NULL;
    NEW.image_moderation_reviewed_at := NULL;
    NEW.image_moderation_review_note := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_items_image_moderation_state ON public.items;
CREATE TRIGGER trg_items_image_moderation_state
BEFORE INSERT OR UPDATE OF image_url ON public.items
FOR EACH ROW
EXECUTE FUNCTION private.set_item_image_moderation_state();

INSERT INTO public.moderation_reviews (
  entity_type,
  entity_id,
  previous_status,
  previous_reason,
  decision_status,
  decision_reason,
  review_note,
  decision_source,
  reviewed_by,
  reviewed_at,
  metadata
)
SELECT
  'ranking',
  r.id,
  r.moderation_status,
  r.moderation_reason,
  r.moderation_status,
  r.moderation_reason,
  r.moderation_review_note,
  'manual',
  r.moderation_reviewed_by,
  r.moderation_reviewed_at,
  jsonb_build_object('migrated_from_legacy', TRUE)
FROM public.rankings r
WHERE r.moderation_reviewed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.moderation_reviews mr
    WHERE mr.entity_type = 'ranking'
      AND mr.entity_id = r.id
      AND mr.reviewed_at = r.moderation_reviewed_at
      AND COALESCE((mr.metadata ->> 'migrated_from_legacy')::BOOLEAN, FALSE)
  );

INSERT INTO public.moderation_reviews (
  entity_type,
  entity_id,
  previous_status,
  previous_reason,
  decision_status,
  decision_reason,
  review_note,
  decision_source,
  reviewed_by,
  reviewed_at,
  metadata
)
SELECT
  'ranking_entry',
  e.id,
  e.moderation_status,
  e.moderation_reason,
  e.moderation_status,
  e.moderation_reason,
  e.moderation_review_note,
  'manual',
  e.moderation_reviewed_by,
  e.moderation_reviewed_at,
  jsonb_build_object('migrated_from_legacy', TRUE)
FROM public.ranking_entries e
WHERE e.moderation_reviewed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.moderation_reviews mr
    WHERE mr.entity_type = 'ranking_entry'
      AND mr.entity_id = e.id
      AND mr.reviewed_at = e.moderation_reviewed_at
      AND COALESCE((mr.metadata ->> 'migrated_from_legacy')::BOOLEAN, FALSE)
  );

INSERT INTO public.moderation_reviews (
  entity_type,
  entity_id,
  previous_status,
  previous_reason,
  decision_status,
  decision_reason,
  review_note,
  decision_source,
  reviewed_by,
  reviewed_at,
  metadata
)
SELECT
  'item',
  i.id,
  i.moderation_status,
  i.moderation_reason,
  i.moderation_status,
  i.moderation_reason,
  i.moderation_review_note,
  'manual',
  i.moderation_reviewed_by,
  i.moderation_reviewed_at,
  jsonb_build_object('migrated_from_legacy', TRUE)
FROM public.items i
WHERE i.moderation_reviewed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.moderation_reviews mr
    WHERE mr.entity_type = 'item'
      AND mr.entity_id = i.id
      AND mr.reviewed_at = i.moderation_reviewed_at
      AND COALESCE((mr.metadata ->> 'migrated_from_legacy')::BOOLEAN, FALSE)
  );

INSERT INTO public.moderation_reviews (
  entity_type,
  entity_id,
  previous_status,
  previous_reason,
  decision_status,
  decision_reason,
  review_note,
  decision_source,
  reviewed_by,
  reviewed_at,
  metadata
)
SELECT
  'comment',
  c.id,
  c.moderation_status,
  c.moderation_reason,
  c.moderation_status,
  c.moderation_reason,
  c.moderation_review_note,
  'manual',
  c.moderation_reviewed_by,
  c.moderation_reviewed_at,
  jsonb_build_object('migrated_from_legacy', TRUE)
FROM public.comments c
WHERE c.moderation_reviewed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.moderation_reviews mr
    WHERE mr.entity_type = 'comment'
      AND mr.entity_id = c.id
      AND mr.reviewed_at = c.moderation_reviewed_at
      AND COALESCE((mr.metadata ->> 'migrated_from_legacy')::BOOLEAN, FALSE)
  );

COMMIT;
