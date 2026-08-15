BEGIN;

CREATE TABLE IF NOT EXISTS public.ranking_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ranking_id UUID NOT NULL REFERENCES public.rankings(id) ON DELETE RESTRICT,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  change_type TEXT NOT NULL CHECK (change_type IN ('vote_finalization', 'vote_void')),
  reason TEXT NOT NULL CHECK (CHAR_LENGTH(reason) BETWEEN 5 AND 1000),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title_snapshot TEXT NOT NULL,
  slug_snapshot TEXT NOT NULL,
  vote_round INTEGER NOT NULL CHECK (vote_round > 0),
  eligible_vote_count BIGINT NOT NULL DEFAULT 0 CHECK (eligible_vote_count >= 0),
  total_ballot_count BIGINT NOT NULL DEFAULT 0 CHECK (total_ballot_count >= 0),
  voting_opened_at TIMESTAMPTZ,
  voting_closed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ranking_id, revision_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ranking_revisions_vote_round
  ON public.ranking_revisions(ranking_id, vote_round);

CREATE INDEX IF NOT EXISTS idx_ranking_revisions_actor
  ON public.ranking_revisions(actor_id);

CREATE TABLE IF NOT EXISTS public.ranking_revision_entries (
  revision_id UUID NOT NULL REFERENCES public.ranking_revisions(id) ON DELETE RESTRICT,
  item_id UUID NOT NULL,
  item_title_snapshot TEXT NOT NULL,
  item_slug_snapshot TEXT NOT NULL,
  reason_snapshot TEXT NOT NULL,
  before_position INTEGER NOT NULL CHECK (before_position > 0),
  after_position INTEGER NOT NULL CHECK (after_position > 0),
  vote_count BIGINT NOT NULL DEFAULT 0 CHECK (vote_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (revision_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_ranking_revision_entries_after_position
  ON public.ranking_revision_entries(revision_id, after_position, item_id);

ALTER TABLE public.ranking_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_revision_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ranking_revisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ranking_revision_entries FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.p2_2_reject_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION '랭킹 변경 이력은 수정하거나 삭제할 수 없습니다.' USING ERRCODE = 'P0004';
END;
$$;

DROP TRIGGER IF EXISTS trg_p2_2_immutable_ranking_revisions ON public.ranking_revisions;
CREATE TRIGGER trg_p2_2_immutable_ranking_revisions
BEFORE UPDATE OR DELETE ON public.ranking_revisions
FOR EACH ROW
EXECUTE FUNCTION private.p2_2_reject_history_mutation();

DROP TRIGGER IF EXISTS trg_p2_2_immutable_ranking_revision_entries ON public.ranking_revision_entries;
CREATE TRIGGER trg_p2_2_immutable_ranking_revision_entries
BEFORE UPDATE OR DELETE ON public.ranking_revision_entries
FOR EACH ROW
EXECUTE FUNCTION private.p2_2_reject_history_mutation();

CREATE OR REPLACE FUNCTION public.get_public_ranking_history(
  p_ranking_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  revision_id UUID,
  revision_number INTEGER,
  change_type TEXT,
  reason TEXT,
  vote_round INTEGER,
  eligible_vote_count BIGINT,
  created_at TIMESTAMPTZ,
  changes JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH public_ranking AS (
    SELECT r.id
    FROM public.rankings r
    WHERE r.id = p_ranking_id
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
  ), selected AS (
    SELECT rr.*
    FROM public.ranking_revisions rr
    JOIN public_ranking pr ON pr.id = rr.ranking_id
    ORDER BY rr.revision_number DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20)
  )
  SELECT
    selected.id AS revision_id,
    selected.revision_number,
    selected.change_type,
    selected.reason,
    selected.vote_round,
    selected.eligible_vote_count,
    selected.created_at,
    CASE
      WHEN selected.change_type <> 'vote_finalization' THEN '[]'::JSONB
      ELSE COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'item_id', entry.item_id,
            'title', entry.item_title_snapshot,
            'slug', entry.item_slug_snapshot,
            'before_position', entry.before_position,
            'after_position', entry.after_position,
            'delta', entry.before_position - entry.after_position,
            'direction', CASE
              WHEN entry.after_position < entry.before_position THEN 'up'
              WHEN entry.after_position > entry.before_position THEN 'down'
              ELSE 'same'
            END,
            'vote_count', entry.vote_count,
            'vote_share', CASE
              WHEN selected.eligible_vote_count = 0 THEN 0::NUMERIC
              ELSE ROUND((entry.vote_count::NUMERIC * 100) / selected.eligible_vote_count::NUMERIC, 2)
            END
          )
          ORDER BY entry.after_position ASC, entry.item_id ASC
        )
        FROM public.ranking_revision_entries entry
        WHERE entry.revision_id = selected.id
      ), '[]'::JSONB)
    END AS changes
  FROM selected
  ORDER BY selected.revision_number DESC;
$$;

CREATE OR REPLACE FUNCTION public.finalize_ranking_vote(
  p_ranking_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reason TEXT := BTRIM(COALESCE(p_reason, ''));
  v_ranking public.rankings%ROWTYPE;
  v_voting_state TEXT;
  v_opened_at TIMESTAMPTZ;
  v_closed_at TIMESTAMPTZ;
  v_entry_count INTEGER;
  v_safe_entry_count INTEGER;
  v_total_votes BIGINT;
  v_revision_number INTEGER;
  v_vote_round INTEGER;
  v_revision_id UUID;
  v_offset INTEGER;
  v_changed_count INTEGER;
BEGIN
  IF NOT private.has_admin_capability(v_user_id, 'content_manage') THEN
    RAISE EXCEPTION '콘텐츠 관리 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF p_ranking_id IS NULL OR CHAR_LENGTH(v_reason) < 5 OR CHAR_LENGTH(v_reason) > 1000 THEN
    RAISE EXCEPTION '확정 사유는 5자 이상 1000자 이하로 입력해 주세요.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('ranking-voting-state:' || p_ranking_id::TEXT, 0)
  );

  SELECT *
  INTO v_ranking
  FROM public.rankings
  WHERE id = p_ranking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '랭킹을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF v_ranking.ranking_type <> 'user_vote' THEN
    RAISE EXCEPTION 'user_vote 유형의 랭킹만 투표 결과를 확정할 수 있습니다.' USING ERRCODE = '22023';
  END IF;

  SELECT settings.state, settings.opened_at, settings.closed_at
  INTO v_voting_state, v_opened_at, v_closed_at
  FROM public.ranking_vote_settings settings
  WHERE settings.ranking_id = p_ranking_id
  FOR UPDATE;

  IF NOT FOUND OR v_voting_state <> 'closed' THEN
    RAISE EXCEPTION '투표를 닫은 뒤에만 결과를 확정할 수 있습니다.' USING ERRCODE = 'P0004';
  END IF;

  IF v_ranking.status <> 'published'
     OR v_ranking.moderation_status NOT IN ('clean', 'suggestive')
     OR v_ranking.image_moderation_status NOT IN ('clean', 'suggestive') THEN
    RAISE EXCEPTION '현재 공개 가능한 published 랭킹만 결과를 확정할 수 있습니다.' USING ERRCODE = 'P0004';
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (
      WHERE re.moderation_status IN ('clean', 'suggestive')
        AND i.status = 'active'
        AND i.moderation_status IN ('clean', 'suggestive')
        AND i.image_moderation_status IN ('clean', 'suggestive')
    )::INTEGER
  INTO v_entry_count, v_safe_entry_count
  FROM public.ranking_entries re
  JOIN public.items i ON i.id = re.item_id
  WHERE re.ranking_id = p_ranking_id;

  IF v_entry_count < 2 THEN
    RAISE EXCEPTION '투표 결과 확정에는 후보가 최소 2개 필요합니다.' USING ERRCODE = 'P0004';
  END IF;

  IF v_safe_entry_count <> v_entry_count THEN
    RAISE EXCEPTION '공개 불가 후보가 포함된 라운드는 확정할 수 없습니다. 복구할 수 없다면 라운드 폐기를 사용해 주세요.' USING ERRCODE = 'P0004';
  END IF;

  SELECT COUNT(*)::BIGINT
  INTO v_total_votes
  FROM public.ranking_votes rv
  WHERE rv.ranking_id = p_ranking_id;

  IF v_total_votes < 1 THEN
    RAISE EXCEPTION '확정할 투표가 없습니다.' USING ERRCODE = 'P0004';
  END IF;

  SELECT COALESCE(MAX(rr.revision_number), 0) + 1
  INTO v_revision_number
  FROM public.ranking_revisions rr
  WHERE rr.ranking_id = p_ranking_id;

  SELECT COALESCE(MAX(rr.vote_round), 0) + 1
  INTO v_vote_round
  FROM public.ranking_revisions rr
  WHERE rr.ranking_id = p_ranking_id;

  INSERT INTO public.ranking_revisions (
    ranking_id,
    revision_number,
    change_type,
    reason,
    actor_id,
    title_snapshot,
    slug_snapshot,
    vote_round,
    eligible_vote_count,
    total_ballot_count,
    voting_opened_at,
    voting_closed_at,
    metadata
  ) VALUES (
    p_ranking_id,
    v_revision_number,
    'vote_finalization',
    v_reason,
    v_user_id,
    v_ranking.title,
    v_ranking.slug,
    v_vote_round,
    v_total_votes,
    v_total_votes,
    v_opened_at,
    v_closed_at,
    jsonb_build_object('ordering', 'vote_count_desc_seed_position_asc_item_id_asc')
  )
  RETURNING id INTO v_revision_id;

  WITH counts AS (
    SELECT rv.item_id, COUNT(*)::BIGINT AS vote_count
    FROM public.ranking_votes rv
    WHERE rv.ranking_id = p_ranking_id
    GROUP BY rv.item_id
  ), ranked AS (
    SELECT
      re.item_id,
      i.title,
      i.slug,
      re.reason,
      re.position AS before_position,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(counts.vote_count, 0) DESC, re.position ASC, re.item_id ASC
      )::INTEGER AS after_position,
      COALESCE(counts.vote_count, 0)::BIGINT AS vote_count
    FROM public.ranking_entries re
    JOIN public.items i ON i.id = re.item_id
    LEFT JOIN counts ON counts.item_id = re.item_id
    WHERE re.ranking_id = p_ranking_id
  )
  INSERT INTO public.ranking_revision_entries (
    revision_id,
    item_id,
    item_title_snapshot,
    item_slug_snapshot,
    reason_snapshot,
    before_position,
    after_position,
    vote_count
  )
  SELECT
    v_revision_id,
    ranked.item_id,
    ranked.title,
    ranked.slug,
    ranked.reason,
    ranked.before_position,
    ranked.after_position,
    ranked.vote_count
  FROM ranked;

  SELECT COUNT(*)::INTEGER
  INTO v_changed_count
  FROM public.ranking_revision_entries entry
  WHERE entry.revision_id = v_revision_id
    AND entry.before_position <> entry.after_position;

  DELETE FROM public.ranking_votes
  WHERE ranking_id = p_ranking_id;

  SELECT COALESCE(MAX(re.position), 0) + v_entry_count + 10
  INTO v_offset
  FROM public.ranking_entries re
  WHERE re.ranking_id = p_ranking_id;

  UPDATE public.ranking_entries
  SET position = position + v_offset
  WHERE ranking_id = p_ranking_id;

  UPDATE public.ranking_entries re
  SET position = snapshot.after_position
  FROM public.ranking_revision_entries snapshot
  WHERE snapshot.revision_id = v_revision_id
    AND re.ranking_id = p_ranking_id
    AND re.item_id = snapshot.item_id;

  UPDATE public.rankings
  SET updated_by = v_user_id,
      updated_at = NOW()
  WHERE id = p_ranking_id;

  UPDATE public.ranking_vote_settings
  SET state = 'closed',
      closed_at = COALESCE(closed_at, NOW()),
      updated_by = v_user_id,
      updated_at = NOW()
  WHERE ranking_id = p_ranking_id;

  RETURN jsonb_build_object(
    'ranking_id', p_ranking_id,
    'revision_id', v_revision_id,
    'revision_number', v_revision_number,
    'vote_round', v_vote_round,
    'total_votes', v_total_votes,
    'changed_count', v_changed_count,
    'state', 'closed'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.void_ranking_vote_round(
  p_ranking_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reason TEXT := BTRIM(COALESCE(p_reason, ''));
  v_ranking public.rankings%ROWTYPE;
  v_voting_state TEXT;
  v_opened_at TIMESTAMPTZ;
  v_closed_at TIMESTAMPTZ;
  v_total_ballots BIGINT;
  v_eligible_votes BIGINT;
  v_revision_number INTEGER;
  v_vote_round INTEGER;
  v_revision_id UUID;
BEGIN
  IF NOT private.has_admin_capability(v_user_id, 'content_manage') THEN
    RAISE EXCEPTION '콘텐츠 관리 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF p_ranking_id IS NULL OR CHAR_LENGTH(v_reason) < 5 OR CHAR_LENGTH(v_reason) > 1000 THEN
    RAISE EXCEPTION '폐기 사유는 5자 이상 1000자 이하로 입력해 주세요.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('ranking-voting-state:' || p_ranking_id::TEXT, 0)
  );

  SELECT *
  INTO v_ranking
  FROM public.rankings
  WHERE id = p_ranking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '랭킹을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF v_ranking.ranking_type <> 'user_vote' THEN
    RAISE EXCEPTION 'user_vote 유형의 랭킹만 투표 라운드를 폐기할 수 있습니다.' USING ERRCODE = '22023';
  END IF;

  SELECT settings.state, settings.opened_at, settings.closed_at
  INTO v_voting_state, v_opened_at, v_closed_at
  FROM public.ranking_vote_settings settings
  WHERE settings.ranking_id = p_ranking_id
  FOR UPDATE;

  IF NOT FOUND OR v_voting_state <> 'closed' THEN
    RAISE EXCEPTION '투표를 닫은 뒤에만 라운드를 폐기할 수 있습니다.' USING ERRCODE = 'P0004';
  END IF;

  SELECT COUNT(*)::BIGINT
  INTO v_total_ballots
  FROM public.ranking_votes rv
  WHERE rv.ranking_id = p_ranking_id;

  IF v_total_ballots < 1 THEN
    RAISE EXCEPTION '폐기할 투표 라운드가 없습니다.' USING ERRCODE = 'P0004';
  END IF;

  SELECT COUNT(*)::BIGINT
  INTO v_eligible_votes
  FROM public.ranking_votes rv
  WHERE rv.ranking_id = p_ranking_id
    AND private.p2_1_is_public_vote_candidate(rv.ranking_id, rv.item_id);

  SELECT COALESCE(MAX(rr.revision_number), 0) + 1
  INTO v_revision_number
  FROM public.ranking_revisions rr
  WHERE rr.ranking_id = p_ranking_id;

  SELECT COALESCE(MAX(rr.vote_round), 0) + 1
  INTO v_vote_round
  FROM public.ranking_revisions rr
  WHERE rr.ranking_id = p_ranking_id;

  INSERT INTO public.ranking_revisions (
    ranking_id,
    revision_number,
    change_type,
    reason,
    actor_id,
    title_snapshot,
    slug_snapshot,
    vote_round,
    eligible_vote_count,
    total_ballot_count,
    voting_opened_at,
    voting_closed_at,
    metadata
  ) VALUES (
    p_ranking_id,
    v_revision_number,
    'vote_void',
    v_reason,
    v_user_id,
    v_ranking.title,
    v_ranking.slug,
    v_vote_round,
    v_eligible_votes,
    v_total_ballots,
    v_opened_at,
    v_closed_at,
    jsonb_build_object('canonical_order_changed', false)
  )
  RETURNING id INTO v_revision_id;

  WITH counts AS (
    SELECT rv.item_id, COUNT(*)::BIGINT AS vote_count
    FROM public.ranking_votes rv
    WHERE rv.ranking_id = p_ranking_id
    GROUP BY rv.item_id
  )
  INSERT INTO public.ranking_revision_entries (
    revision_id,
    item_id,
    item_title_snapshot,
    item_slug_snapshot,
    reason_snapshot,
    before_position,
    after_position,
    vote_count
  )
  SELECT
    v_revision_id,
    re.item_id,
    i.title,
    i.slug,
    re.reason,
    re.position,
    re.position,
    COALESCE(counts.vote_count, 0)::BIGINT
  FROM public.ranking_entries re
  JOIN public.items i ON i.id = re.item_id
  LEFT JOIN counts ON counts.item_id = re.item_id
  WHERE re.ranking_id = p_ranking_id;

  DELETE FROM public.ranking_votes
  WHERE ranking_id = p_ranking_id;

  UPDATE public.rankings
  SET updated_by = v_user_id,
      updated_at = NOW()
  WHERE id = p_ranking_id;

  UPDATE public.ranking_vote_settings
  SET state = 'closed',
      closed_at = COALESCE(closed_at, NOW()),
      updated_by = v_user_id,
      updated_at = NOW()
  WHERE ranking_id = p_ranking_id;

  RETURN jsonb_build_object(
    'ranking_id', p_ranking_id,
    'revision_id', v_revision_id,
    'revision_number', v_revision_number,
    'vote_round', v_vote_round,
    'eligible_votes', v_eligible_votes,
    'total_ballots', v_total_ballots,
    'state', 'closed'
  );
END;
$$;

REVOKE ALL ON FUNCTION private.p2_2_reject_history_mutation() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_public_ranking_history(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_ranking_vote(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_ranking_vote_round(UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_public_ranking_history(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_ranking_vote(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_ranking_vote_round(UUID, TEXT) TO authenticated;

COMMIT;
