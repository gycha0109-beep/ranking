BEGIN;

CREATE OR REPLACE FUNCTION private.normalize_comment_body(p_body TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT regexp_replace(BTRIM(COALESCE(p_body, '')), '[[:space:]]+', ' ', 'g');
$$;

CREATE OR REPLACE FUNCTION private.evaluate_comment_moderation(p_body TEXT)
RETURNS TABLE (
  decision_status TEXT,
  decision_reason TEXT,
  matched_term_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH normalized AS (
    SELECT lower(COALESCE(p_body, '')) AS body_text,
           regexp_replace(lower(COALESCE(p_body, '')), '[[:space:][:punct:]]+', '', 'g') AS compact_body
  ), term_values AS (
    SELECT mt.id,
           mt.category,
           mt.severity,
           mt.match_mode,
           lower(BTRIM(mt.term)) AS normalized_term,
           regexp_replace(lower(BTRIM(mt.term)), '[[:space:][:punct:]]+', '', 'g') AS compact_term
    FROM public.moderation_terms mt
    WHERE mt.enabled
      AND BTRIM(mt.term) <> ''
  ), matches AS (
    SELECT tv.id,
           tv.category,
           CASE
             WHEN tv.severity = 'block' THEN 'blocked'
             WHEN tv.category = 'sexual_suggestive' THEN 'suggestive'
             ELSE 'needs_review'
           END AS status,
           CASE
             WHEN tv.severity = 'block' THEN 3
             WHEN tv.category = 'sexual_suggestive' THEN 1
             ELSE 2
           END AS priority,
           char_length(tv.normalized_term) AS term_length
    FROM term_values tv
    CROSS JOIN normalized n
    WHERE (tv.match_mode = 'substring' AND n.body_text LIKE '%' || tv.normalized_term || '%')
       OR (tv.match_mode = 'compact_substring'
           AND tv.compact_term <> ''
           AND n.compact_body LIKE '%' || tv.compact_term || '%')
  )
  SELECT m.status, m.category, m.id
  FROM matches m
  ORDER BY m.priority DESC, m.term_length DESC, m.id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'clean'::TEXT, 'none'::TEXT, NULL::UUID;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_comment_rate(
  p_user_id UUID,
  p_event_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_minute_count INTEGER := 0;
  v_hour_count INTEGER := 0;
BEGIN
  IF p_event_type NOT IN ('create', 'update', 'delete') THEN
    RAISE EXCEPTION '지원하지 않는 댓글 작업입니다.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('comment-rate:' || p_user_id::TEXT, 0)
  );

  SELECT COUNT(*)::INTEGER
  INTO v_hour_count
  FROM public.comment_mutation_events
  WHERE user_id = p_user_id
    AND event_type = p_event_type
    AND created_at >= NOW() - INTERVAL '1 hour';

  IF p_event_type = 'create' THEN
    SELECT COUNT(*)::INTEGER
    INTO v_minute_count
    FROM public.comment_mutation_events
    WHERE user_id = p_user_id
      AND event_type = 'create'
      AND created_at >= NOW() - INTERVAL '1 minute';

    IF v_minute_count >= 5 OR v_hour_count >= 30 THEN
      RAISE EXCEPTION '댓글 작성 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_event_type = 'update' AND v_hour_count >= 20 THEN
    RAISE EXCEPTION '댓글 수정 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' USING ERRCODE = 'P0001';
  ELSIF p_event_type = 'delete' AND v_hour_count >= 30 THEN
    RAISE EXCEPTION '댓글 삭제 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.lock_public_comment_target(
  p_ranking_id UUID,
  p_item_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_eligible_ranking_id UUID;
BEGIN
  IF num_nonnulls(p_ranking_id, p_item_id) <> 1 THEN
    RAISE EXCEPTION '댓글 대상이 올바르지 않습니다.' USING ERRCODE = '22023';
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
      RAISE EXCEPTION '공개된 랭킹에만 댓글을 작성할 수 있습니다.' USING ERRCODE = 'P0002';
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
      RAISE EXCEPTION '공개 가능한 활성 아이템에만 댓글을 작성할 수 있습니다.' USING ERRCODE = 'P0002';
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
      RAISE EXCEPTION '공개 랭킹에 연결된 아이템에만 댓글을 작성할 수 있습니다.' USING ERRCODE = 'P0002';
    END IF;
  END IF;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.create_ranking_comment(
  p_ranking_id UUID,
  p_body TEXT,
  p_parent_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.create_content_comment(p_ranking_id, NULL, p_body, p_parent_id);
$$;

CREATE OR REPLACE FUNCTION public.create_item_comment(
  p_item_id UUID,
  p_body TEXT,
  p_parent_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.create_content_comment(NULL, p_item_id, p_body, p_parent_id);
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

CREATE OR REPLACE FUNCTION public.delete_own_comment(
  p_comment_id UUID,
  p_expected_updated_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_comment public.comments%ROWTYPE;
  v_updated_at TIMESTAMPTZ;
BEGIN
  PERFORM set_config('statement_timeout', '5000', TRUE);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_comment
  FROM public.comments
  WHERE id = p_comment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '댓글을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF v_comment.user_id <> v_user_id THEN
    RAISE EXCEPTION '본인의 댓글만 삭제할 수 있습니다.' USING ERRCODE = '42501';
  END IF;

  IF v_comment.status = 'deleted' THEN
    RETURN jsonb_build_object(
      'comment_id', p_comment_id,
      'visibility', 'deleted',
      'updated_at', v_comment.updated_at
    );
  END IF;

  IF p_expected_updated_at IS NULL
     OR v_comment.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION '댓글이 다른 세션에서 변경되었습니다.' USING ERRCODE = '40001';
  END IF;

  PERFORM private.enforce_comment_rate(v_user_id, 'delete');

  UPDATE public.comments
  SET status = 'deleted',
      deleted_at = NOW()
  WHERE id = p_comment_id
  RETURNING updated_at INTO v_updated_at;

  INSERT INTO public.comment_mutation_events(
    user_id, comment_id, ranking_id, item_id, event_type
  ) VALUES (
    v_user_id, p_comment_id, v_comment.ranking_id, v_comment.item_id, 'delete'
  );

  RETURN jsonb_build_object(
    'comment_id', p_comment_id,
    'visibility', 'deleted',
    'updated_at', v_updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION private.normalize_comment_body(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.evaluate_comment_moderation(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enforce_comment_rate(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.lock_public_comment_target(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.create_content_comment(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_ranking_comment(UUID, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_item_comment(UUID, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_own_comment(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_own_comment(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_ranking_comment(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_item_comment(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_comment(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_comment(UUID, TIMESTAMPTZ) TO authenticated;

COMMIT;
