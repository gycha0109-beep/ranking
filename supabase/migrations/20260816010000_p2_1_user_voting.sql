BEGIN;

CREATE TABLE IF NOT EXISTS public.ranking_vote_settings (
  ranking_id UUID PRIMARY KEY REFERENCES public.rankings(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'closed' CHECK (state IN ('open', 'closed')),
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ranking_votes (
  ranking_id UUID NOT NULL REFERENCES public.rankings(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ranking_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ranking_votes_ranking_item
  ON public.ranking_votes(ranking_id, item_id);

ALTER TABLE public.ranking_vote_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_votes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ranking_vote_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ranking_votes FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.p2_1_is_public_vote_candidate(
  p_ranking_id UUID,
  p_item_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rankings r
    JOIN public.ranking_entries re ON re.ranking_id = r.id
    JOIN public.items i ON i.id = re.item_id
    WHERE r.id = p_ranking_id
      AND re.item_id = p_item_id
      AND r.ranking_type = 'user_vote'
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
      AND re.moderation_status IN ('clean', 'suggestive')
      AND i.status = 'active'
      AND i.moderation_status IN ('clean', 'suggestive')
      AND i.image_moderation_status IN ('clean', 'suggestive')
  );
$$;

CREATE OR REPLACE FUNCTION private.p2_1_reconcile_open_state(
  p_ranking_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_candidate_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.ranking_vote_settings settings
    WHERE settings.ranking_id = p_ranking_id
      AND settings.state = 'open'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.rankings r
    WHERE r.id = p_ranking_id
      AND r.ranking_type = 'user_vote'
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
  ) THEN
    UPDATE public.ranking_vote_settings
    SET state = 'closed', closed_at = NOW(), updated_at = NOW()
    WHERE ranking_id = p_ranking_id AND state = 'open';
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO v_candidate_count
  FROM public.ranking_entries re
  JOIN public.items i ON i.id = re.item_id
  WHERE re.ranking_id = p_ranking_id
    AND re.moderation_status IN ('clean', 'suggestive')
    AND i.status = 'active'
    AND i.moderation_status IN ('clean', 'suggestive')
    AND i.image_moderation_status IN ('clean', 'suggestive');

  IF v_candidate_count < 2 THEN
    UPDATE public.ranking_vote_settings
    SET state = 'closed', closed_at = NOW(), updated_at = NOW()
    WHERE ranking_id = p_ranking_id AND state = 'open';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ranking_vote_summary(
  p_ranking_id UUID
)
RETURNS TABLE (
  item_id UUID,
  seed_position INTEGER,
  vote_count BIGINT,
  total_votes BIGINT,
  vote_share NUMERIC,
  current_rank BIGINT,
  voting_state TEXT
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
      AND r.ranking_type = 'user_vote'
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
  ), candidates AS (
    SELECT re.item_id, re.position AS seed_position
    FROM public_ranking pr
    JOIN public.ranking_entries re ON re.ranking_id = pr.id
    JOIN public.items i ON i.id = re.item_id
    WHERE re.moderation_status IN ('clean', 'suggestive')
      AND i.status = 'active'
      AND i.moderation_status IN ('clean', 'suggestive')
      AND i.image_moderation_status IN ('clean', 'suggestive')
  ), counts AS (
    SELECT rv.item_id, COUNT(*)::BIGINT AS vote_count
    FROM public.ranking_votes rv
    JOIN candidates c ON c.item_id = rv.item_id
    WHERE rv.ranking_id = p_ranking_id
    GROUP BY rv.item_id
  ), totals AS (
    SELECT COALESCE(SUM(c.vote_count), 0)::BIGINT AS total_votes
    FROM counts c
  )
  SELECT
    candidate.item_id,
    candidate.seed_position,
    COALESCE(counts.vote_count, 0)::BIGINT AS vote_count,
    totals.total_votes,
    CASE
      WHEN totals.total_votes = 0 THEN 0::NUMERIC
      ELSE ROUND((COALESCE(counts.vote_count, 0)::NUMERIC * 100) / totals.total_votes::NUMERIC, 2)
    END AS vote_share,
    ROW_NUMBER() OVER (
      ORDER BY COALESCE(counts.vote_count, 0) DESC, candidate.seed_position ASC, candidate.item_id ASC
    ) AS current_rank,
    COALESCE(settings.state, 'closed') AS voting_state
  FROM candidates candidate
  CROSS JOIN totals
  LEFT JOIN counts ON counts.item_id = candidate.item_id
  LEFT JOIN public.ranking_vote_settings settings ON settings.ranking_id = p_ranking_id
  ORDER BY current_rank ASC, candidate.item_id ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_my_ranking_vote(
  p_ranking_id UUID
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT rv.item_id
  FROM public.ranking_votes rv
  WHERE rv.ranking_id = p_ranking_id
    AND rv.user_id = auth.uid()
    AND private.p2_1_is_public_vote_candidate(rv.ranking_id, rv.item_id)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_ranking_vote(
  p_ranking_id UUID,
  p_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_state TEXT;
  v_candidate_count INTEGER;
BEGIN
  PERFORM private.assert_user_capability(v_user_id, 'engagement_write');

  IF p_ranking_id IS NULL OR p_item_id IS NULL THEN
    RAISE EXCEPTION '투표 대상이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock_shared(
    hashtextextended('ranking-voting-state:' || p_ranking_id::TEXT, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('ranking-vote-user:' || p_ranking_id::TEXT || ':' || v_user_id::TEXT, 0)
  );

  SELECT settings.state
  INTO v_state
  FROM public.ranking_vote_settings settings
  WHERE settings.ranking_id = p_ranking_id;

  IF COALESCE(v_state, 'closed') <> 'open' THEN
    RAISE EXCEPTION '현재 투표가 열려 있지 않습니다.' USING ERRCODE = 'P0004';
  END IF;

  SELECT COUNT(*)
  INTO v_candidate_count
  FROM public.ranking_entries re
  JOIN public.items i ON i.id = re.item_id
  WHERE re.ranking_id = p_ranking_id
    AND re.moderation_status IN ('clean', 'suggestive')
    AND i.status = 'active'
    AND i.moderation_status IN ('clean', 'suggestive')
    AND i.image_moderation_status IN ('clean', 'suggestive');

  IF v_candidate_count < 2 THEN
    RAISE EXCEPTION '현재 공개 가능한 투표 후보가 부족합니다.' USING ERRCODE = 'P0004';
  END IF;

  IF NOT private.p2_1_is_public_vote_candidate(p_ranking_id, p_item_id) THEN
    RAISE EXCEPTION '현재 공개 투표 후보가 아닙니다.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ranking_votes(ranking_id, item_id, user_id, created_at, updated_at)
  VALUES (p_ranking_id, p_item_id, v_user_id, NOW(), NOW())
  ON CONFLICT (ranking_id, user_id)
  DO UPDATE SET item_id = EXCLUDED.item_id, updated_at = NOW();

  RETURN jsonb_build_object('ranking_id', p_ranking_id, 'item_id', p_item_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_ranking_vote(
  p_ranking_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_state TEXT;
BEGIN
  PERFORM private.assert_user_capability(v_user_id, 'engagement_write');

  IF p_ranking_id IS NULL THEN
    RAISE EXCEPTION '투표 대상이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock_shared(
    hashtextextended('ranking-voting-state:' || p_ranking_id::TEXT, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('ranking-vote-user:' || p_ranking_id::TEXT || ':' || v_user_id::TEXT, 0)
  );

  SELECT settings.state
  INTO v_state
  FROM public.ranking_vote_settings settings
  WHERE settings.ranking_id = p_ranking_id;

  IF COALESCE(v_state, 'closed') <> 'open' THEN
    RAISE EXCEPTION '현재 투표가 열려 있지 않습니다.' USING ERRCODE = 'P0004';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.rankings r
    WHERE r.id = p_ranking_id
      AND r.ranking_type = 'user_vote'
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
  ) THEN
    RAISE EXCEPTION '현재 공개 투표 랭킹이 아닙니다.' USING ERRCODE = 'P0004';
  END IF;

  DELETE FROM public.ranking_votes
  WHERE ranking_id = p_ranking_id
    AND user_id = v_user_id;

  RETURN jsonb_build_object('ranking_id', p_ranking_id, 'item_id', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_ranking_voting_state(
  p_ranking_id UUID,
  p_state TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_state TEXT := LOWER(BTRIM(COALESCE(p_state, '')));
  v_ranking public.rankings%ROWTYPE;
  v_candidate_count INTEGER;
  v_total_votes BIGINT;
BEGIN
  IF NOT private.has_admin_capability(v_user_id, 'content_manage') THEN
    RAISE EXCEPTION '콘텐츠 관리 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF p_ranking_id IS NULL OR v_state NOT IN ('open', 'closed') THEN
    RAISE EXCEPTION '투표 상태 값이 올바르지 않습니다.' USING ERRCODE = '22023';
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
    RAISE EXCEPTION 'user_vote 유형의 랭킹만 투표 상태를 관리할 수 있습니다.' USING ERRCODE = '22023';
  END IF;

  IF v_state = 'open' THEN
    IF v_ranking.status <> 'published'
       OR v_ranking.moderation_status NOT IN ('clean', 'suggestive')
       OR v_ranking.image_moderation_status NOT IN ('clean', 'suggestive') THEN
      RAISE EXCEPTION '공개 가능한 published 랭킹만 투표를 열 수 있습니다.' USING ERRCODE = 'P0004';
    END IF;

    SELECT COUNT(*)
    INTO v_candidate_count
    FROM public.ranking_entries re
    JOIN public.items i ON i.id = re.item_id
    WHERE re.ranking_id = p_ranking_id
      AND re.moderation_status IN ('clean', 'suggestive')
      AND i.status = 'active'
      AND i.moderation_status IN ('clean', 'suggestive')
      AND i.image_moderation_status IN ('clean', 'suggestive');

    IF v_candidate_count < 2 THEN
      RAISE EXCEPTION '공개 가능한 투표 후보가 최소 2개 필요합니다.' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  INSERT INTO public.ranking_vote_settings(
    ranking_id, state, opened_at, closed_at, updated_by, created_at, updated_at
  ) VALUES (
    p_ranking_id,
    v_state,
    CASE WHEN v_state = 'open' THEN NOW() ELSE NULL END,
    CASE WHEN v_state = 'closed' THEN NOW() ELSE NULL END,
    v_user_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (ranking_id)
  DO UPDATE SET
    state = EXCLUDED.state,
    opened_at = CASE WHEN EXCLUDED.state = 'open' THEN NOW() ELSE public.ranking_vote_settings.opened_at END,
    closed_at = CASE WHEN EXCLUDED.state = 'closed' THEN NOW() ELSE NULL END,
    updated_by = v_user_id,
    updated_at = NOW();

  SELECT COUNT(*) INTO v_total_votes
  FROM public.ranking_votes
  WHERE ranking_id = p_ranking_id;

  RETURN jsonb_build_object('ranking_id', p_ranking_id, 'state', v_state, 'total_votes', v_total_votes);
END;
$$;

CREATE OR REPLACE FUNCTION private.p2_1_freeze_voted_ranking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ranking_id UUID := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('ranking-voting-state:' || v_ranking_id::TEXT, 0)
  );

  IF EXISTS (SELECT 1 FROM public.ranking_votes WHERE ranking_id = v_ranking_id) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION '투표 기록이 존재하는 랭킹은 삭제할 수 없습니다.' USING ERRCODE = 'P0004';
    END IF;

    IF (to_jsonb(NEW) - ARRAY[
      'status', 'published_at', 'updated_at',
      'moderation_status', 'moderation_reason', 'moderation_reviewed_by', 'moderation_reviewed_at', 'moderation_review_note',
      'image_moderation_status', 'image_moderation_reason'
    ]) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY[
      'status', 'published_at', 'updated_at',
      'moderation_status', 'moderation_reason', 'moderation_reviewed_by', 'moderation_reviewed_at', 'moderation_review_note',
      'image_moderation_status', 'image_moderation_reason'
    ]) THEN
      RAISE EXCEPTION '첫 투표 이후에는 랭킹 문서와 후보 구성을 수정할 수 없습니다.' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_p2_1_freeze_voted_ranking ON public.rankings;
CREATE TRIGGER trg_p2_1_freeze_voted_ranking
BEFORE UPDATE OR DELETE ON public.rankings
FOR EACH ROW
EXECUTE FUNCTION private.p2_1_freeze_voted_ranking();

CREATE OR REPLACE FUNCTION private.p2_1_freeze_voted_entries()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ranking_id UUID := CASE WHEN TG_OP = 'DELETE' THEN OLD.ranking_id ELSE NEW.ranking_id END;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('ranking-voting-state:' || v_ranking_id::TEXT, 0)
  );

  IF EXISTS (SELECT 1 FROM public.ranking_votes WHERE ranking_id = v_ranking_id) THEN
    IF TG_OP <> 'UPDATE'
       OR (to_jsonb(NEW) - ARRAY[
         'updated_at', 'moderation_status', 'moderation_reason', 'moderation_reviewed_by', 'moderation_reviewed_at', 'moderation_review_note'
       ]) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY[
         'updated_at', 'moderation_status', 'moderation_reason', 'moderation_reviewed_by', 'moderation_reviewed_at', 'moderation_review_note'
       ]) THEN
      RAISE EXCEPTION '첫 투표 이후에는 투표 후보를 수정할 수 없습니다.' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_p2_1_freeze_voted_entries ON public.ranking_entries;
CREATE TRIGGER trg_p2_1_freeze_voted_entries
BEFORE INSERT OR UPDATE OR DELETE ON public.ranking_entries
FOR EACH ROW
EXECUTE FUNCTION private.p2_1_freeze_voted_entries();

CREATE OR REPLACE FUNCTION private.p2_1_reconcile_ranking_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  PERFORM private.p2_1_reconcile_open_state(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_p2_1_reconcile_ranking ON public.rankings;
CREATE TRIGGER trg_p2_1_reconcile_ranking
AFTER UPDATE OF status, ranking_type, moderation_status, image_moderation_status ON public.rankings
FOR EACH ROW
EXECUTE FUNCTION private.p2_1_reconcile_ranking_trigger();

CREATE OR REPLACE FUNCTION private.p2_1_reconcile_entry_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_ranking_id UUID := CASE WHEN TG_OP = 'DELETE' THEN OLD.ranking_id ELSE NEW.ranking_id END;
BEGIN
  PERFORM private.p2_1_reconcile_open_state(v_ranking_id);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_p2_1_reconcile_entry ON public.ranking_entries;
CREATE TRIGGER trg_p2_1_reconcile_entry
AFTER INSERT OR UPDATE OR DELETE ON public.ranking_entries
FOR EACH ROW
EXECUTE FUNCTION private.p2_1_reconcile_entry_trigger();

CREATE OR REPLACE FUNCTION private.p2_1_reconcile_item_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_ranking_id UUID;
BEGIN
  FOR v_ranking_id IN
    SELECT DISTINCT re.ranking_id
    FROM public.ranking_entries re
    WHERE re.item_id = NEW.id
  LOOP
    PERFORM pg_advisory_xact_lock(
      hashtextextended('ranking-voting-state:' || v_ranking_id::TEXT, 0)
    );
    PERFORM private.p2_1_reconcile_open_state(v_ranking_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_p2_1_reconcile_item ON public.items;
CREATE TRIGGER trg_p2_1_reconcile_item
AFTER UPDATE OF status, moderation_status, image_moderation_status ON public.items
FOR EACH ROW
EXECUTE FUNCTION private.p2_1_reconcile_item_trigger();

REVOKE ALL ON FUNCTION private.p2_1_is_public_vote_candidate(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.p2_1_reconcile_open_state(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.p2_1_freeze_voted_ranking() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.p2_1_freeze_voted_entries() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.p2_1_reconcile_ranking_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.p2_1_reconcile_entry_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.p2_1_reconcile_item_trigger() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_ranking_vote_summary(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_ranking_vote(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_ranking_vote(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clear_ranking_vote(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_ranking_voting_state(UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_ranking_vote_summary(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_ranking_vote(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_ranking_vote(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_ranking_vote(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_ranking_voting_state(UUID, TEXT) TO authenticated;

COMMIT;
