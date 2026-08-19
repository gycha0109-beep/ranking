BEGIN;

CREATE TABLE public.ranking_revalidations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ranking_id UUID NOT NULL REFERENCES public.rankings(id) ON DELETE RESTRICT,
  outcome TEXT NOT NULL CHECK (
    outcome IN ('verified_unchanged', 'updated', 'source_changed', 'source_unavailable')
  ),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_review_at TIMESTAMPTZ NOT NULL,
  review_note TEXT NOT NULL CHECK (CHAR_LENGTH(BTRIM(review_note)) BETWEEN 5 AND 2000),
  source_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(source_snapshot) = 'array'),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (next_review_at > verified_at)
);

CREATE INDEX idx_ranking_revalidations_ranking_verified
  ON public.ranking_revalidations(ranking_id, verified_at DESC, id DESC);

CREATE INDEX idx_ranking_revalidations_next_review
  ON public.ranking_revalidations(next_review_at, ranking_id);

ALTER TABLE public.ranking_revalidations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ranking_revalidations FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.content_3_reject_revalidation_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION '콘텐츠 재검증 기록은 수정하거나 삭제할 수 없습니다.' USING ERRCODE = 'P0004';
END;
$$;

CREATE TRIGGER trg_content_3_immutable_ranking_revalidations
BEFORE UPDATE OR DELETE ON public.ranking_revalidations
FOR EACH ROW
EXECUTE FUNCTION private.content_3_reject_revalidation_mutation();

CREATE OR REPLACE FUNCTION public.admin_get_ranking_revalidation_status(
  p_ranking_id UUID DEFAULT NULL
)
RETURNS TABLE (
  ranking_id UUID,
  ranking_status TEXT,
  latest_review_id UUID,
  outcome TEXT,
  verified_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  freshness_state TEXT,
  review_note TEXT,
  source_snapshot JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF NOT private.has_admin_capability(v_user_id, 'content_manage') THEN
    RAISE EXCEPTION '콘텐츠 관리 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.status,
    latest.id,
    latest.outcome,
    latest.verified_at,
    latest.next_review_at,
    CASE
      WHEN r.status <> 'published' THEN 'not_applicable'
      WHEN latest.id IS NULL THEN 'never_reviewed'
      WHEN latest.outcome IN ('source_changed', 'source_unavailable') THEN 'attention_required'
      WHEN latest.next_review_at <= NOW() THEN 'overdue'
      WHEN latest.next_review_at <= NOW() + INTERVAL '7 days' THEN 'due_soon'
      ELSE 'current'
    END,
    latest.review_note,
    latest.source_snapshot
  FROM public.rankings r
  LEFT JOIN LATERAL (
    SELECT rr.*
    FROM public.ranking_revalidations rr
    WHERE rr.ranking_id = r.id
    ORDER BY rr.verified_at DESC, rr.id DESC
    LIMIT 1
  ) latest ON TRUE
  WHERE p_ranking_id IS NULL OR r.id = p_ranking_id
  ORDER BY
    CASE
      WHEN r.status = 'published' AND latest.id IS NULL THEN 0
      WHEN latest.outcome IN ('source_changed', 'source_unavailable') THEN 1
      WHEN latest.next_review_at <= NOW() THEN 2
      WHEN latest.next_review_at <= NOW() + INTERVAL '7 days' THEN 3
      ELSE 4
    END,
    latest.next_review_at NULLS FIRST,
    r.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_record_ranking_revalidation(
  p_ranking_id UUID,
  p_outcome TEXT,
  p_next_review_at TIMESTAMPTZ,
  p_review_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_outcome TEXT := LOWER(BTRIM(COALESCE(p_outcome, '')));
  v_note TEXT := BTRIM(COALESCE(p_review_note, ''));
  v_ranking public.rankings%ROWTYPE;
  v_source_snapshot JSONB;
  v_revalidation_id UUID;
  v_verified_at TIMESTAMPTZ := NOW();
BEGIN
  IF NOT private.has_admin_capability(v_user_id, 'content_manage') THEN
    RAISE EXCEPTION '콘텐츠 관리 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF p_ranking_id IS NULL THEN
    RAISE EXCEPTION '랭킹 ID가 필요합니다.' USING ERRCODE = '22023';
  END IF;

  IF v_outcome NOT IN ('verified_unchanged', 'updated', 'source_changed', 'source_unavailable') THEN
    RAISE EXCEPTION '지원하지 않는 재검증 결과입니다.' USING ERRCODE = '22023';
  END IF;

  IF CHAR_LENGTH(v_note) < 5 OR CHAR_LENGTH(v_note) > 2000 THEN
    RAISE EXCEPTION '재검증 메모는 5자 이상 2000자 이하로 입력해 주세요.' USING ERRCODE = '22023';
  END IF;

  IF p_next_review_at IS NULL OR p_next_review_at <= v_verified_at THEN
    RAISE EXCEPTION '다음 검증일은 현재 시각보다 이후여야 합니다.' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_ranking
  FROM public.rankings
  WHERE id = p_ranking_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '랭킹을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF v_ranking.status <> 'published' THEN
    RAISE EXCEPTION '현재 공개 중인 랭킹만 재검증 기록을 남길 수 있습니다.' USING ERRCODE = 'P0004';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', rs.id,
        'label', rs.label,
        'url', rs.url,
        'source_type', rs.source_type,
        'note', rs.note,
        'is_public', rs.is_public
      ) ORDER BY rs.created_at ASC, rs.id ASC
    ),
    '[]'::JSONB
  )
  INTO v_source_snapshot
  FROM public.ranking_sources rs
  WHERE rs.ranking_id = p_ranking_id;

  INSERT INTO public.ranking_revalidations (
    ranking_id,
    outcome,
    verified_at,
    next_review_at,
    review_note,
    source_snapshot,
    actor_id
  ) VALUES (
    p_ranking_id,
    v_outcome,
    v_verified_at,
    p_next_review_at,
    v_note,
    v_source_snapshot,
    v_user_id
  )
  RETURNING id INTO v_revalidation_id;

  RETURN jsonb_build_object(
    'id', v_revalidation_id,
    'ranking_id', p_ranking_id,
    'outcome', v_outcome,
    'verified_at', v_verified_at,
    'next_review_at', p_next_review_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_ranking_revalidations(
  p_ranking_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  ranking_id UUID,
  outcome TEXT,
  verified_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  review_note TEXT,
  source_snapshot JSONB,
  actor_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF NOT private.has_admin_capability(v_user_id, 'content_manage') THEN
    RAISE EXCEPTION '콘텐츠 관리 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF p_ranking_id IS NULL THEN
    RAISE EXCEPTION '랭킹 ID가 필요합니다.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    rr.id,
    rr.ranking_id,
    rr.outcome,
    rr.verified_at,
    rr.next_review_at,
    rr.review_note,
    rr.source_snapshot,
    rr.actor_id,
    rr.created_at
  FROM public.ranking_revalidations rr
  WHERE rr.ranking_id = p_ranking_id
  ORDER BY rr.verified_at DESC, rr.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_ranking_revalidation_status(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_record_ranking_revalidation(UUID, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_ranking_revalidations(UUID, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_get_ranking_revalidation_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_ranking_revalidation(UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_ranking_revalidations(UUID, INTEGER) TO authenticated;

COMMIT;
