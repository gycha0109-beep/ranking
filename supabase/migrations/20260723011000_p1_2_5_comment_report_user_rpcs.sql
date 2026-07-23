BEGIN;

CREATE OR REPLACE FUNCTION private.normalize_comment_report_details(p_details TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT NULLIF(
    regexp_replace(BTRIM(COALESCE(p_details, '')), '[[:space:]]+', ' ', 'g'),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.report_content_comment(
  p_comment_id UUID,
  p_ranking_id UUID,
  p_item_id UUID,
  p_reason TEXT,
  p_details TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_details TEXT := private.normalize_comment_report_details(p_details);
  v_comment public.comments%ROWTYPE;
  v_hour_count INTEGER;
  v_day_count INTEGER;
  v_report_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  PERFORM set_config('statement_timeout', '5000', TRUE);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF num_nonnulls(p_ranking_id, p_item_id) <> 1 THEN
    RAISE EXCEPTION '댓글 신고 대상이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_reason NOT IN (
    'spam',
    'harassment',
    'hate',
    'sexual',
    'violence',
    'privacy',
    'illegal',
    'misinformation',
    'other'
  ) THEN
    RAISE EXCEPTION '신고 사유가 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF v_details IS NOT NULL AND char_length(v_details) > 500 THEN
    RAISE EXCEPTION '상세 신고 사유는 500자 이하로 입력해 주세요.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('comment-report-user:' || v_user_id::TEXT, 0)
  );

  SELECT COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')::INTEGER,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::INTEGER
  INTO v_hour_count, v_day_count
  FROM public.comment_reports
  WHERE reporter_id = v_user_id
    AND created_at >= NOW() - INTERVAL '24 hours';

  IF v_hour_count >= 5 OR v_day_count >= 15 THEN
    RAISE EXCEPTION '댓글 신고 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('comment-report-case:' || p_comment_id::TEXT, 0)
  );

  SELECT *
  INTO v_comment
  FROM public.comments
  WHERE id = p_comment_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '신고할 댓글을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF v_comment.ranking_id IS DISTINCT FROM p_ranking_id
     OR v_comment.item_id IS DISTINCT FROM p_item_id THEN
    RAISE EXCEPTION '댓글과 콘텐츠 대상이 일치하지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_ranking_id IS NOT NULL AND NOT private.is_public_ranking(p_ranking_id) THEN
    RAISE EXCEPTION '공개된 랭킹의 댓글만 신고할 수 있습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF p_item_id IS NOT NULL AND NOT private.is_public_item(p_item_id) THEN
    RAISE EXCEPTION '공개된 아이템의 댓글만 신고할 수 있습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF v_comment.user_id = v_user_id THEN
    RAISE EXCEPTION '본인의 댓글은 신고할 수 없습니다.' USING ERRCODE = '22023';
  END IF;

  IF v_comment.status <> 'visible'
     OR v_comment.moderation_status NOT IN ('clean', 'suggestive') THEN
    RAISE EXCEPTION '현재 공개된 댓글만 신고할 수 있습니다.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.comment_reports cr
    WHERE cr.comment_id = p_comment_id
      AND cr.reporter_id = v_user_id
  ) THEN
    RAISE EXCEPTION '이미 신고한 댓글입니다.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.comment_reports(
    comment_id,
    reporter_id,
    reason,
    details
  ) VALUES (
    p_comment_id,
    v_user_id,
    p_reason,
    v_details
  )
  RETURNING id, created_at
  INTO v_report_id, v_created_at;

  RETURN jsonb_build_object(
    'report_id', v_report_id,
    'status', 'pending',
    'created_at', v_created_at
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION '이미 신고한 댓글입니다.' USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_reported_comment_ids(p_comment_ids UUID[])
RETURNS TABLE(comment_id UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(cardinality(p_comment_ids), 0) > 200 THEN
    RAISE EXCEPTION '한 번에 조회할 수 있는 댓글 수를 초과했습니다.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT DISTINCT cr.comment_id
  FROM public.comment_reports cr
  WHERE cr.reporter_id = v_user_id
    AND cr.comment_id = ANY(COALESCE(p_comment_ids, ARRAY[]::UUID[]));
END;
$$;

REVOKE ALL ON FUNCTION private.normalize_comment_report_details(TEXT)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.report_content_comment(UUID, UUID, UUID, TEXT, TEXT)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_content_comment(UUID, UUID, UUID, TEXT, TEXT)
TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_reported_comment_ids(UUID[])
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_reported_comment_ids(UUID[])
TO authenticated;

COMMIT;
