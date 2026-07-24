BEGIN;

CREATE OR REPLACE FUNCTION private.create_content_comment(
  p_ranking_id UUID,
  p_item_id UUID,
  p_body TEXT,
  p_parent_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_body TEXT := private.normalize_comment_body(p_body);
  v_status TEXT;
  v_reason TEXT;
  v_term_id UUID;
  v_comment_id UUID;
  v_lifecycle TEXT;
  v_updated_at TIMESTAMPTZ;
  v_parent public.comments%ROWTYPE;
BEGIN
  PERFORM set_config('statement_timeout', '5000', TRUE);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  PERFORM private.assert_user_capability(v_user_id, 'comment_write');

  PERFORM 1 FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '댓글 작성자 프로필을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF char_length(v_body) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION '댓글은 1자 이상 2,000자 이하로 입력해 주세요.' USING ERRCODE = '22023';
  END IF;

  PERFORM private.enforce_comment_rate(v_user_id, 'create');
  PERFORM private.lock_public_comment_target(p_ranking_id, p_item_id);

  IF p_parent_id IS NOT NULL THEN
    SELECT *
    INTO v_parent
    FROM public.comments
    WHERE id = p_parent_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION '답글 대상 댓글을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
    END IF;

    IF v_parent.parent_id IS NOT NULL THEN
      RAISE EXCEPTION '답글에는 다시 답글을 작성할 수 없습니다.' USING ERRCODE = '22023';
    END IF;

    IF v_parent.ranking_id IS DISTINCT FROM p_ranking_id
       OR v_parent.item_id IS DISTINCT FROM p_item_id THEN
      RAISE EXCEPTION '답글 대상과 댓글 대상이 일치하지 않습니다.' USING ERRCODE = '22023';
    END IF;

    IF v_parent.status <> 'visible'
       OR v_parent.moderation_status NOT IN ('clean', 'suggestive') THEN
      RAISE EXCEPTION '현재 공개된 댓글에만 답글을 작성할 수 있습니다.' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT decision_status, decision_reason, matched_term_id
  INTO v_status, v_reason, v_term_id
  FROM private.evaluate_comment_moderation(v_body);

  INSERT INTO public.comments(
    user_id,
    ranking_id,
    item_id,
    parent_id,
    body,
    status,
    moderation_status,
    moderation_reason,
    moderation_reviewed_by,
    moderation_reviewed_at,
    moderation_review_note
  ) VALUES (
    v_user_id,
    p_ranking_id,
    p_item_id,
    p_parent_id,
    v_body,
    CASE WHEN v_status IN ('clean', 'suggestive') THEN 'visible' ELSE 'hidden' END,
    v_status,
    v_reason,
    NULL,
    NULL,
    NULL
  )
  RETURNING id, status, updated_at
  INTO v_comment_id, v_lifecycle, v_updated_at;

  INSERT INTO public.moderation_reviews(
    entity_type,
    entity_id,
    previous_status,
    previous_reason,
    decision_status,
    decision_reason,
    review_note,
    decision_source,
    matched_term_id,
    reviewed_by,
    reviewed_at,
    metadata
  ) VALUES (
    'comment',
    v_comment_id,
    'needs_review',
    'none',
    v_status,
    v_reason,
    NULL,
    'automated',
    v_term_id,
    NULL,
    NOW(),
    jsonb_build_object('event', 'create', 'parent_id', p_parent_id)
  );

  INSERT INTO public.comment_mutation_events(
    user_id, comment_id, ranking_id, item_id, event_type
  ) VALUES (
    v_user_id, v_comment_id, p_ranking_id, p_item_id, 'create'
  );

  RETURN jsonb_build_object(
    'comment_id', v_comment_id,
    'visibility', v_status,
    'lifecycle', v_lifecycle,
    'updated_at', v_updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_own_comment(
  p_comment_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_body TEXT := private.normalize_comment_body(p_body);
  v_comment public.comments%ROWTYPE;
  v_status TEXT;
  v_reason TEXT;
  v_term_id UUID;
  v_updated_at TIMESTAMPTZ;
  v_lifecycle TEXT;
BEGIN
  PERFORM set_config('statement_timeout', '5000', TRUE);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  PERFORM private.assert_user_capability(v_user_id, 'comment_write');

  IF char_length(v_body) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION '댓글은 1자 이상 2,000자 이하로 입력해 주세요.' USING ERRCODE = '22023';
  END IF;

  PERFORM private.enforce_comment_rate(v_user_id, 'update');

  SELECT *
  INTO v_comment
  FROM public.comments
  WHERE id = p_comment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '댓글을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF v_comment.user_id <> v_user_id THEN
    RAISE EXCEPTION '본인의 댓글만 수정할 수 있습니다.' USING ERRCODE = '42501';
  END IF;

  IF v_comment.status = 'deleted' THEN
    RAISE EXCEPTION '삭제된 댓글은 수정할 수 없습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_expected_updated_at IS NULL
     OR v_comment.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION '댓글이 다른 세션에서 변경되었습니다.' USING ERRCODE = '40001';
  END IF;

  SELECT decision_status, decision_reason, matched_term_id
  INTO v_status, v_reason, v_term_id
  FROM private.evaluate_comment_moderation(v_body);

  UPDATE public.comments
  SET body = v_body,
      moderation_status = v_status,
      moderation_reason = v_reason,
      moderation_reviewed_by = NULL,
      moderation_reviewed_at = NULL,
      moderation_review_note = NULL,
      body_redacted_at = NULL
  WHERE id = p_comment_id
  RETURNING status, updated_at INTO v_lifecycle, v_updated_at;

  INSERT INTO public.moderation_reviews(
    entity_type,
    entity_id,
    previous_status,
    previous_reason,
    decision_status,
    decision_reason,
    review_note,
    decision_source,
    matched_term_id,
    reviewed_by,
    reviewed_at,
    metadata
  ) VALUES (
    'comment',
    p_comment_id,
    v_comment.moderation_status,
    v_comment.moderation_reason,
    v_status,
    v_reason,
    NULL,
    'automated',
    v_term_id,
    NULL,
    NOW(),
    jsonb_build_object('event', 'edit')
  );

  INSERT INTO public.comment_mutation_events(
    user_id, comment_id, ranking_id, item_id, event_type
  ) VALUES (
    v_user_id, p_comment_id, v_comment.ranking_id, v_comment.item_id, 'update'
  );

  RETURN jsonb_build_object(
    'comment_id', p_comment_id,
    'visibility', v_status,
    'lifecycle', v_lifecycle,
    'updated_at', v_updated_at
  );
END;
$$;

DROP FUNCTION IF EXISTS public.create_comment_report(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_my_comment_report_states(UUID[]);

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

  PERFORM private.assert_user_capability(v_user_id, 'report_comment');

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
  RETURNING id, created_at INTO v_report_id, v_created_at;

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

CREATE OR REPLACE FUNCTION private.set_content_like(
  p_ranking_id UUID,
  p_item_id UUID,
  p_liked BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_like_id UUID;
  v_changed BOOLEAN := FALSE;
  v_like_count BIGINT;
  v_recent_requests INTEGER;
  v_target_key TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF p_liked THEN
    PERFORM private.assert_user_capability(v_user_id, 'engagement_write');
  END IF;

  IF num_nonnulls(p_ranking_id, p_item_id) <> 1 THEN
    RAISE EXCEPTION '좋아요 대상이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_ranking_id IS NOT NULL THEN
    PERFORM 1
    FROM public.rankings r
    WHERE r.id = p_ranking_id
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION '공개된 랭킹만 좋아요할 수 있습니다.' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    PERFORM 1
    FROM public.items i
    WHERE i.id = p_item_id
      AND i.status = 'active'
      AND i.moderation_status IN ('clean', 'suggestive')
      AND i.image_moderation_status IN ('clean', 'suggestive')
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION '활성 아이템만 좋아요할 수 있습니다.' USING ERRCODE = 'P0002';
    END IF;

    PERFORM 1
    FROM public.ranking_entries e
    JOIN public.rankings r ON r.id = e.ranking_id
    WHERE e.item_id = p_item_id
      AND e.moderation_status IN ('clean', 'suggestive')
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
    LIMIT 1
    FOR SHARE OF e, r;

    IF NOT FOUND THEN
      RAISE EXCEPTION '공개 랭킹에 연결된 아이템만 좋아요할 수 있습니다.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('content-like-rate:' || v_user_id::TEXT, 0)
  );

  SELECT COUNT(*)::INTEGER
  INTO v_recent_requests
  FROM public.content_like_events
  WHERE user_id = v_user_id
    AND created_at >= NOW() - INTERVAL '1 minute';

  IF v_recent_requests >= 60 THEN
    RAISE EXCEPTION '좋아요 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' USING ERRCODE = 'P0001';
  END IF;

  v_target_key := CASE
    WHEN p_ranking_id IS NOT NULL THEN 'ranking:' || p_ranking_id::TEXT
    ELSE 'item:' || p_item_id::TEXT
  END;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('content-like-target:' || v_user_id::TEXT || ':' || v_target_key, 0)
  );

  SELECT id
  INTO v_like_id
  FROM public.content_likes
  WHERE user_id = v_user_id
    AND ranking_id IS NOT DISTINCT FROM p_ranking_id
    AND item_id IS NOT DISTINCT FROM p_item_id
  FOR UPDATE;

  IF p_liked AND v_like_id IS NULL THEN
    INSERT INTO public.content_likes(user_id, ranking_id, item_id)
    VALUES(v_user_id, p_ranking_id, p_item_id);
    v_changed := TRUE;
  ELSIF NOT p_liked AND v_like_id IS NOT NULL THEN
    DELETE FROM public.content_likes WHERE id = v_like_id;
    v_changed := TRUE;
  END IF;

  INSERT INTO public.content_like_events(
    user_id, ranking_id, item_id, requested_liked, changed
  ) VALUES (
    v_user_id, p_ranking_id, p_item_id, p_liked, v_changed
  );

  SELECT COUNT(*)
  INTO v_like_count
  FROM public.content_likes
  WHERE ranking_id IS NOT DISTINCT FROM p_ranking_id
    AND item_id IS NOT DISTINCT FROM p_item_id;

  RETURN jsonb_build_object(
    'liked', p_liked,
    'like_count', v_like_count,
    'changed', v_changed
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.set_content_bookmark(
  p_ranking_id UUID,
  p_item_id UUID,
  p_bookmarked BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_bookmark_id UUID;
  v_changed BOOLEAN := FALSE;
  v_recent_requests INTEGER;
  v_target_key TEXT;
  v_eligible_ranking_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF p_bookmarked THEN
    PERFORM private.assert_user_capability(v_user_id, 'engagement_write');
  END IF;

  IF num_nonnulls(p_ranking_id, p_item_id) <> 1 THEN
    RAISE EXCEPTION '북마크 대상이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('content-bookmark-rate:' || v_user_id::TEXT, 0)
  );

  SELECT COUNT(*)::INTEGER
  INTO v_recent_requests
  FROM public.content_bookmark_events
  WHERE user_id = v_user_id
    AND created_at >= NOW() - INTERVAL '1 minute';

  IF v_recent_requests >= 60 THEN
    RAISE EXCEPTION '북마크 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' USING ERRCODE = 'P0001';
  END IF;

  IF p_ranking_id IS NOT NULL THEN
    PERFORM 1
    FROM public.rankings r
    WHERE r.id = p_ranking_id
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION '공개된 랭킹만 북마크할 수 있습니다.' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    PERFORM 1
    FROM public.items i
    WHERE i.id = p_item_id
      AND i.status = 'active'
      AND i.moderation_status IN ('clean', 'suggestive')
      AND i.image_moderation_status IN ('clean', 'suggestive')
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION '공개 가능한 활성 아이템만 북마크할 수 있습니다.' USING ERRCODE = 'P0002';
    END IF;

    SELECT r.id
    INTO v_eligible_ranking_id
    FROM public.ranking_entries e
    JOIN public.rankings r ON r.id = e.ranking_id
    WHERE e.item_id = p_item_id
      AND e.moderation_status IN ('clean', 'suggestive')
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
    ORDER BY r.id
    LIMIT 1
    FOR SHARE OF e, r;

    IF v_eligible_ranking_id IS NULL THEN
      RAISE EXCEPTION '공개 랭킹에 연결된 아이템만 북마크할 수 있습니다.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  v_target_key := CASE
    WHEN p_ranking_id IS NOT NULL THEN 'ranking:' || p_ranking_id::TEXT
    ELSE 'item:' || p_item_id::TEXT
  END;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('content-bookmark:' || v_user_id::TEXT || ':' || v_target_key, 0)
  );

  SELECT id
  INTO v_bookmark_id
  FROM public.content_bookmarks
  WHERE user_id = v_user_id
    AND ranking_id IS NOT DISTINCT FROM p_ranking_id
    AND item_id IS NOT DISTINCT FROM p_item_id
  FOR UPDATE;

  IF p_bookmarked AND v_bookmark_id IS NULL THEN
    INSERT INTO public.content_bookmarks(user_id, ranking_id, item_id)
    VALUES(v_user_id, p_ranking_id, p_item_id);
    v_changed := TRUE;
  ELSIF NOT p_bookmarked AND v_bookmark_id IS NOT NULL THEN
    DELETE FROM public.content_bookmarks WHERE id = v_bookmark_id;
    v_changed := TRUE;
  END IF;

  INSERT INTO public.content_bookmark_events(
    user_id, ranking_id, item_id, requested_bookmarked, changed
  ) VALUES (
    v_user_id, p_ranking_id, p_item_id, p_bookmarked, v_changed
  );

  RETURN jsonb_build_object(
    'bookmarked', p_bookmarked,
    'changed', v_changed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.report_content_comment(UUID, UUID, UUID, TEXT, TEXT)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_content_comment(UUID, UUID, UUID, TEXT, TEXT)
TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_reported_comment_ids(UUID[])
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_reported_comment_ids(UUID[])
TO authenticated;

REVOKE ALL ON FUNCTION private.create_content_comment(UUID, UUID, TEXT, UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.set_content_like(UUID, UUID, BOOLEAN)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.set_content_bookmark(UUID, UUID, BOOLEAN)
FROM PUBLIC, anon, authenticated;

COMMIT;
