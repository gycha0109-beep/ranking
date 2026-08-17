BEGIN;

-- Reconcile the repository contract with the RPC names currently exposed by
-- the hosted database. The canonical functions are defined here so a fresh
-- migration replay and the hosted project converge on the same contract.
CREATE OR REPLACE FUNCTION public.create_comment_report(
  p_comment_id UUID,
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
  v_reason TEXT := lower(btrim(coalesce(p_reason, '')));
  v_details TEXT := nullif(btrim(coalesce(p_details, '')), '');
  v_comment_author UUID;
  v_comment_status TEXT;
  v_comment_moderation TEXT;
  v_comment_target_exists BOOLEAN;
  v_report_id UUID;
  v_recent_minute INTEGER;
  v_recent_day INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF v_reason NOT IN ('spam','harassment','hate','sexual','violence','privacy','illegal','misinformation','other') THEN
    RAISE EXCEPTION '유효하지 않은 신고 사유입니다.' USING ERRCODE = '22023';
  END IF;

  IF v_details IS NOT NULL AND char_length(v_details) > 500 THEN
    RAISE EXCEPTION '신고 상세 내용은 500자 이하로 입력해 주세요.' USING ERRCODE = '22023';
  END IF;

  SELECT
    c.user_id,
    c.status,
    c.moderation_status,
    (
      (c.ranking_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.rankings r
        WHERE r.id = c.ranking_id
          AND r.status = 'published'
          AND r.moderation_status IN ('clean','suggestive')
          AND r.image_moderation_status IN ('clean','suggestive')
      ))
      OR
      (c.item_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.items i
        WHERE i.id = c.item_id
          AND i.status = 'active'
          AND i.moderation_status IN ('clean','suggestive')
          AND i.image_moderation_status IN ('clean','suggestive')
          AND EXISTS (
            SELECT 1
            FROM public.ranking_entries re
            JOIN public.rankings r ON r.id = re.ranking_id
            WHERE re.item_id = i.id
              AND r.status = 'published'
              AND r.moderation_status IN ('clean','suggestive')
              AND r.image_moderation_status IN ('clean','suggestive')
          )
      ))
    )
  INTO v_comment_author, v_comment_status, v_comment_moderation, v_comment_target_exists
  FROM public.comments c
  WHERE c.id = p_comment_id
  FOR SHARE;

  IF NOT FOUND OR NOT coalesce(v_comment_target_exists, false) THEN
    RAISE EXCEPTION '신고할 댓글을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF v_comment_status = 'deleted' OR v_comment_moderation <> 'clean' THEN
    RAISE EXCEPTION '현재 공개된 댓글만 신고할 수 있습니다.' USING ERRCODE = '22023';
  END IF;

  IF v_comment_author = v_user_id THEN
    RAISE EXCEPTION '본인 댓글은 신고할 수 없습니다.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.comment_reports
    WHERE comment_id = p_comment_id
      AND reporter_id = v_user_id
  ) THEN
    RAISE EXCEPTION '이미 신고한 댓글입니다.' USING ERRCODE = '23505';
  END IF;

  SELECT count(*)::INTEGER
  INTO v_recent_minute
  FROM public.comment_reports
  WHERE reporter_id = v_user_id
    AND created_at >= now() - interval '1 minute';

  SELECT count(*)::INTEGER
  INTO v_recent_day
  FROM public.comment_reports
  WHERE reporter_id = v_user_id
    AND created_at >= now() - interval '24 hours';

  IF v_recent_minute >= 3 OR v_recent_day >= 30 THEN
    RAISE EXCEPTION '신고 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.comment_reports(comment_id, reporter_id, reason, details)
  VALUES (p_comment_id, v_user_id, v_reason, v_details)
  RETURNING id INTO v_report_id;

  RETURN jsonb_build_object('report_id', v_report_id, 'status', 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_comment_report_states(p_comment_ids UUID[])
RETURNS TABLE(comment_id UUID, status TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT cr.comment_id, cr.status
  FROM public.comment_reports cr
  WHERE auth.uid() IS NOT NULL
    AND cr.reporter_id = auth.uid()
    AND cr.comment_id = ANY(coalesce(p_comment_ids, ARRAY[]::UUID[]));
$$;

-- Compatibility wrappers keep the current application server actions working
-- while making the hosted canonical contract explicit in source control.
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
BEGIN
  IF num_nonnulls(p_ranking_id, p_item_id) <> 1 THEN
    RAISE EXCEPTION '댓글 신고 대상이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.comments c
  WHERE c.id = p_comment_id
    AND c.ranking_id IS NOT DISTINCT FROM p_ranking_id
    AND c.item_id IS NOT DISTINCT FROM p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '댓글과 콘텐츠 대상이 일치하지 않습니다.' USING ERRCODE = '22023';
  END IF;

  RETURN public.create_comment_report(p_comment_id, p_reason, p_details);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_reported_comment_ids(p_comment_ids UUID[])
RETURNS TABLE(comment_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT states.comment_id
  FROM public.get_my_comment_report_states(p_comment_ids) AS states;
$$;

REVOKE ALL ON FUNCTION public.create_comment_report(UUID, TEXT, TEXT)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_comment_report(UUID, TEXT, TEXT)
TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_comment_report_states(UUID[])
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_comment_report_states(UUID[])
TO authenticated;

REVOKE ALL ON FUNCTION public.report_content_comment(UUID, UUID, UUID, TEXT, TEXT)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_content_comment(UUID, UUID, UUID, TEXT, TEXT)
TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_reported_comment_ids(UUID[])
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_reported_comment_ids(UUID[])
TO authenticated;

COMMIT;
