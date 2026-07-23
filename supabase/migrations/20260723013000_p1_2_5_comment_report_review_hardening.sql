BEGIN;

CREATE OR REPLACE FUNCTION public.list_comment_report_queue(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  comment_id UUID,
  comment_body TEXT,
  lifecycle_status TEXT,
  moderation_status TEXT,
  moderation_reason TEXT,
  author_id UUID,
  author_display_name TEXT,
  target_type TEXT,
  target_id UUID,
  target_slug TEXT,
  target_title TEXT,
  pending_count BIGINT,
  total_count BIGINT,
  first_reported_at TIMESTAMPTZ,
  last_reported_at TIMESTAMPTZ,
  reason_counts JSONB,
  latest_details TEXT,
  latest_reported_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH aggregate_rows AS (
    SELECT
      cr.comment_id,
      count(*) FILTER (WHERE cr.status = 'pending') AS pending_count,
      count(*) AS total_count,
      min(cr.created_at) FILTER (WHERE cr.status = 'pending') AS first_reported_at,
      max(cr.created_at) FILTER (WHERE cr.status = 'pending') AS last_reported_at
    FROM public.comment_reports cr
    GROUP BY cr.comment_id
    HAVING count(*) FILTER (WHERE cr.status = 'pending') > 0
  ), reason_rows AS (
    SELECT
      grouped.comment_id,
      jsonb_object_agg(grouped.reason, grouped.reason_count ORDER BY grouped.reason) AS reason_counts
    FROM (
      SELECT cr.comment_id, cr.reason, count(*)::BIGINT AS reason_count
      FROM public.comment_reports cr
      WHERE cr.status = 'pending'
      GROUP BY cr.comment_id, cr.reason
    ) grouped
    GROUP BY grouped.comment_id
  ), latest AS (
    SELECT DISTINCT ON (cr.comment_id)
      cr.comment_id,
      cr.details,
      cr.created_at
    FROM public.comment_reports cr
    WHERE cr.status = 'pending'
    ORDER BY cr.comment_id, cr.created_at DESC, cr.id DESC
  )
  SELECT
    c.id,
    c.body,
    c.status,
    c.moderation_status,
    c.moderation_reason,
    c.user_id,
    coalesce(p.display_name, '알 수 없는 사용자'),
    CASE WHEN c.ranking_id IS NOT NULL THEN 'ranking' ELSE 'item' END,
    coalesce(c.ranking_id, c.item_id),
    coalesce(r.slug, i.slug),
    coalesce(r.title, i.name, '제목 없음'),
    aggregate_rows.pending_count,
    aggregate_rows.total_count,
    aggregate_rows.first_reported_at,
    aggregate_rows.last_reported_at,
    coalesce(reason_rows.reason_counts, '{}'::jsonb),
    latest.details,
    latest.created_at
  FROM aggregate_rows
  JOIN public.comments c ON c.id = aggregate_rows.comment_id
  LEFT JOIN reason_rows ON reason_rows.comment_id = c.id
  LEFT JOIN public.profiles p ON p.id = c.user_id
  LEFT JOIN public.rankings r ON r.id = c.ranking_id
  LEFT JOIN public.items i ON i.id = c.item_id
  LEFT JOIN latest ON latest.comment_id = c.id
  ORDER BY aggregate_rows.last_reported_at ASC, c.id ASC
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 200)
  OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_comment_report_case(
  p_comment_id UUID,
  p_resolution TEXT,
  p_decision_reason TEXT DEFAULT 'none',
  p_author_action TEXT DEFAULT 'none',
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_resolution TEXT := lower(btrim(coalesce(p_resolution, '')));
  v_reason TEXT := lower(btrim(coalesce(p_decision_reason, 'none')));
  v_author_action TEXT := lower(btrim(coalesce(p_author_action, 'none')));
  v_note TEXT := nullif(btrim(coalesce(p_note, '')), '');
  v_pending_count INTEGER;
  v_decision_id BIGINT;
  v_current_status TEXT;
  v_current_reason TEXT;
  v_target_status TEXT;
  v_target_reason TEXT;
  v_report_status TEXT;
BEGIN
  IF v_user_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF v_resolution NOT IN ('dismissed','kept','hidden','blocked') THEN
    RAISE EXCEPTION '유효하지 않은 신고 처리 결과입니다.' USING ERRCODE = '22023';
  END IF;

  IF v_author_action NOT IN ('none','warning') THEN
    RAISE EXCEPTION '유효하지 않은 작성자 조치입니다.' USING ERRCODE = '22023';
  END IF;

  IF v_note IS NULL OR char_length(v_note) < 10 OR char_length(v_note) > 2000 THEN
    RAISE EXCEPTION '신고 처리에는 10자 이상 2,000자 이하의 검토 메모가 필요합니다.' USING ERRCODE = '22023';
  END IF;

  SELECT moderation_status, moderation_reason
  INTO v_current_status, v_current_reason
  FROM public.comments
  WHERE id = p_comment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '댓글을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1
  FROM public.comment_reports
  WHERE comment_id = p_comment_id
    AND status = 'pending'
  FOR UPDATE;

  GET DIAGNOSTICS v_pending_count = ROW_COUNT;
  IF v_pending_count <= 0 THEN
    RAISE EXCEPTION '처리할 대기 신고가 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF v_resolution IN ('dismissed','kept') THEN
    v_reason := 'none';
    v_target_status := v_current_status;
    v_target_reason := v_current_reason;
    v_report_status := CASE WHEN v_resolution = 'dismissed' THEN 'dismissed' ELSE 'resolved' END;
  ELSE
    IF v_reason NOT IN ('sexual_suggestive','explicit_sexual','minor_sexualization','real_person_sexualization','hate','violence','privacy','illegal','spam','system_error') THEN
      RAISE EXCEPTION '숨김 또는 차단 조치에는 유효한 정책 사유가 필요합니다.' USING ERRCODE = '22023';
    END IF;
    v_target_status := CASE WHEN v_resolution = 'hidden' THEN 'needs_review' ELSE 'blocked' END;
    v_target_reason := v_reason;
    v_report_status := 'resolved';
  END IF;

  PERFORM private.apply_moderation_review(
    'comment',
    p_comment_id,
    v_target_status,
    v_target_reason,
    v_note
  );

  INSERT INTO public.comment_report_decisions(
    comment_id,
    reviewed_by,
    pending_count_snapshot,
    resolution,
    author_action,
    decision_reason,
    review_note
  )
  VALUES (
    p_comment_id,
    v_user_id,
    v_pending_count,
    v_resolution,
    v_author_action,
    v_reason,
    v_note
  )
  RETURNING id INTO v_decision_id;

  UPDATE public.comment_reports
  SET
    status = v_report_status,
    resolved_at = now(),
    resolved_by = v_user_id,
    decision_id = v_decision_id
  WHERE comment_id = p_comment_id
    AND status = 'pending';

  RETURN jsonb_build_object(
    'decision_id', v_decision_id,
    'resolved_reports', v_pending_count,
    'resolution', v_resolution,
    'moderation_status', v_target_status
  );
END;
$$;

COMMIT;
