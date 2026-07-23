BEGIN;

CREATE OR REPLACE FUNCTION public.get_pending_comment_report_case_count()
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(DISTINCT cr.comment_id)
  INTO v_count
  FROM public.comment_reports cr
  WHERE cr.status = 'pending';

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_comment_report_queue(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  comment_id UUID,
  body TEXT,
  lifecycle_status TEXT,
  moderation_status TEXT,
  moderation_reason TEXT,
  comment_created_at TIMESTAMPTZ,
  author_display_name TEXT,
  target_type TEXT,
  target_id UUID,
  target_slug TEXT,
  target_title TEXT,
  report_count BIGINT,
  reason_counts JSONB,
  detail_samples JSONB,
  oldest_reported_at TIMESTAMPTZ,
  newest_reported_at TIMESTAMPTZ,
  author_warning_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH pending_cases AS (
    SELECT cr.comment_id,
           COUNT(*)::BIGINT AS report_count,
           MIN(cr.created_at) AS oldest_reported_at,
           MAX(cr.created_at) AS newest_reported_at
    FROM public.comment_reports cr
    WHERE cr.status = 'pending'
    GROUP BY cr.comment_id
    ORDER BY MIN(cr.created_at), cr.comment_id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ), reason_counts AS (
    SELECT reason_rows.comment_id,
           jsonb_object_agg(reason_rows.reason, reason_rows.reason_count ORDER BY reason_rows.reason) AS counts
    FROM (
      SELECT cr.comment_id,
             cr.reason,
             COUNT(*)::BIGINT AS reason_count
      FROM public.comment_reports cr
      JOIN pending_cases pc ON pc.comment_id = cr.comment_id
      WHERE cr.status = 'pending'
      GROUP BY cr.comment_id, cr.reason
    ) reason_rows
    GROUP BY reason_rows.comment_id
  )
  SELECT c.id,
         c.body,
         c.status,
         c.moderation_status,
         c.moderation_reason,
         c.created_at,
         p.display_name,
         CASE WHEN c.ranking_id IS NOT NULL THEN 'ranking' ELSE 'item' END,
         COALESCE(c.ranking_id, c.item_id),
         COALESCE(r.slug, i.slug),
         COALESCE(r.title, i.title),
         pc.report_count,
         COALESCE(rc.counts, '{}'::JSONB),
         COALESCE(details.samples, '[]'::JSONB),
         pc.oldest_reported_at,
         pc.newest_reported_at,
         COALESCE(warnings.warning_count, 0)
  FROM pending_cases pc
  JOIN public.comments c ON c.id = pc.comment_id
  JOIN public.profiles p ON p.id = c.user_id
  LEFT JOIN public.rankings r ON r.id = c.ranking_id
  LEFT JOIN public.items i ON i.id = c.item_id
  LEFT JOIN reason_counts rc ON rc.comment_id = c.id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'reason', sample.reason,
        'details', sample.details,
        'created_at', sample.created_at
      )
      ORDER BY sample.created_at DESC, sample.id DESC
    ) AS samples
    FROM (
      SELECT cr.id, cr.reason, cr.details, cr.created_at
      FROM public.comment_reports cr
      WHERE cr.comment_id = c.id
        AND cr.status = 'pending'
        AND cr.details IS NOT NULL
      ORDER BY cr.created_at DESC, cr.id DESC
      LIMIT 10
    ) sample
  ) details ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::BIGINT AS warning_count
    FROM public.comment_report_decisions d
    JOIN public.comments warned_comment ON warned_comment.id = d.comment_id
    WHERE warned_comment.user_id = c.user_id
      AND d.author_action = 'warning'
  ) warnings ON TRUE
  ORDER BY pc.oldest_reported_at, c.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_comment_report_case(
  p_comment_id UUID,
  p_expected_pending_count INTEGER,
  p_resolution TEXT,
  p_author_action TEXT,
  p_decision_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_note TEXT := NULLIF(BTRIM(COALESCE(p_note, '')), '');
  v_reason TEXT := COALESCE(NULLIF(BTRIM(p_decision_reason), ''), 'none');
  v_comment public.comments%ROWTYPE;
  v_report_ids UUID[] := ARRAY[]::UUID[];
  v_pending_count INTEGER := 0;
  v_decision_id BIGINT;
  v_resolved_at TIMESTAMPTZ := NOW();
BEGIN
  PERFORM set_config('statement_timeout', '10000', TRUE);

  IF v_user_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF p_resolution NOT IN ('dismissed', 'kept', 'hidden', 'blocked') THEN
    RAISE EXCEPTION '신고 처리 결과가 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_author_action NOT IN ('none', 'warning') THEN
    RAISE EXCEPTION '작성자 조치가 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF v_reason NOT IN (
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
    RAISE EXCEPTION 'Moderation 사유가 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_resolution IN ('dismissed', 'kept') THEN
    v_reason := 'none';
  ELSIF v_reason = 'none' THEN
    RAISE EXCEPTION '댓글 숨김 또는 차단에는 Moderation 사유가 필요합니다.' USING ERRCODE = '22023';
  END IF;

  IF v_note IS NOT NULL AND char_length(v_note) > 2000 THEN
    RAISE EXCEPTION '관리자 메모는 2,000자 이하로 입력해 주세요.' USING ERRCODE = '22023';
  END IF;

  IF (p_resolution IN ('hidden', 'blocked') OR p_author_action = 'warning')
     AND COALESCE(char_length(v_note), 0) < 10 THEN
    RAISE EXCEPTION '숨김, 차단 또는 경고 조치에는 10자 이상의 관리자 메모가 필요합니다.' USING ERRCODE = '22023';
  END IF;

  IF p_expected_pending_count IS NULL OR p_expected_pending_count < 1 THEN
    RAISE EXCEPTION '신고 사건 스냅샷이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('comment-report-case:' || p_comment_id::TEXT, 0)
  );

  SELECT *
  INTO v_comment
  FROM public.comments
  WHERE id = p_comment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '신고 대상 댓글을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  WITH locked_reports AS (
    SELECT cr.id
    FROM public.comment_reports cr
    WHERE cr.comment_id = p_comment_id
      AND cr.status = 'pending'
    ORDER BY cr.created_at, cr.id
    FOR UPDATE
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]), COUNT(*)::INTEGER
  INTO v_report_ids, v_pending_count
  FROM locked_reports;

  IF v_pending_count = 0 THEN
    RAISE EXCEPTION '처리할 pending 신고가 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF v_pending_count <> p_expected_pending_count THEN
    RAISE EXCEPTION '신고 사건이 다른 화면에서 변경되었습니다.' USING ERRCODE = '40001';
  END IF;

  IF v_comment.status = 'deleted' AND p_resolution IN ('hidden', 'blocked') THEN
    RAISE EXCEPTION '삭제된 댓글에는 숨김 또는 차단 조치를 적용할 수 없습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_resolution = 'hidden' THEN
    PERFORM private.apply_moderation_review(
      'comment',
      p_comment_id,
      'needs_review',
      v_reason,
      v_note
    );
  ELSIF p_resolution = 'blocked' THEN
    PERFORM private.apply_moderation_review(
      'comment',
      p_comment_id,
      'blocked',
      v_reason,
      v_note
    );
  END IF;

  INSERT INTO public.comment_report_decisions(
    comment_id,
    reviewed_by,
    pending_count_snapshot,
    resolution,
    author_action,
    decision_reason,
    review_note,
    created_at
  ) VALUES (
    p_comment_id,
    v_user_id,
    v_pending_count,
    p_resolution,
    p_author_action,
    v_reason,
    v_note,
    v_resolved_at
  )
  RETURNING id INTO v_decision_id;

  UPDATE public.comment_reports
  SET status = CASE WHEN p_resolution = 'dismissed' THEN 'dismissed' ELSE 'resolved' END,
      resolved_at = v_resolved_at,
      resolved_by = v_user_id,
      decision_id = v_decision_id
  WHERE id = ANY(v_report_ids);

  RETURN jsonb_build_object(
    'comment_id', p_comment_id,
    'decision_id', v_decision_id,
    'processed_count', v_pending_count,
    'resolution', p_resolution,
    'author_action', p_author_action,
    'resolved_at', v_resolved_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_pending_comment_report_case_count()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pending_comment_report_case_count()
TO authenticated;

REVOKE ALL ON FUNCTION public.list_comment_report_queue(INTEGER, INTEGER)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_comment_report_queue(INTEGER, INTEGER)
TO authenticated;

REVOKE ALL ON FUNCTION public.review_comment_report_case(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_comment_report_case(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT)
TO authenticated;

COMMIT;
