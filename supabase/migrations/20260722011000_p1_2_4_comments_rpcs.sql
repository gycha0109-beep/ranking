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
  ), matches AS (
    SELECT mt.id,
           mt.category,
           CASE
             WHEN mt.severity = 'block' THEN 'blocked'
             WHEN mt.category = 'sexual_suggestive' THEN 'suggestive'
             ELSE 'needs_review'
           END AS status,
           CASE
             WHEN mt.severity = 'block' THEN 3
             WHEN mt.category = 'sexual_suggestive' THEN 1
             ELSE 2
           END AS priority,
           char_length(mt.term) AS term_length
    FROM public.moderation_terms mt
    CROSS JOIN normalized n
    WHERE mt.enabled
      AND (
        (mt.match_mode = 'substring' AND n.body_text LIKE '%' || lower(mt.term) || '%')
        OR
        (mt.match_mode = 'compact_substring'
          AND n.compact_body LIKE '%' || regexp_replace(lower(mt.term), '[[:space:][:punct:]]+', '', 'g') || '%')
      )
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
  v_minute_count INTEGER;
  v_hour_count INTEGER;
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

  PERFORM private.enforce_comment_rate(v_user_id, 'delete');

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

CREATE OR REPLACE FUNCTION private.list_content_comments(
  p_ranking_id UUID,
  p_item_id UUID,
  p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_root_ids UUID[] := ARRAY[]::UUID[];
  v_root_count INTEGER := 0;
  v_last_created_at TIMESTAMPTZ;
  v_last_id UUID;
  v_comments JSONB := '[]'::JSONB;
BEGIN
  IF num_nonnulls(p_ranking_id, p_item_id) <> 1 THEN
    RAISE EXCEPTION '댓글 대상이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF (p_cursor_created_at IS NULL) <> (p_cursor_id IS NULL) THEN
    RAISE EXCEPTION '댓글 커서가 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_ranking_id IS NOT NULL AND NOT private.is_public_ranking(p_ranking_id) THEN
    RAISE EXCEPTION '공개된 랭킹을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF p_item_id IS NOT NULL AND NOT private.is_public_item(p_item_id) THEN
    RAISE EXCEPTION '공개된 아이템을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  WITH root_page AS (
    SELECT c.id, c.created_at
    FROM public.comments c
    WHERE c.parent_id IS NULL
      AND c.ranking_id IS NOT DISTINCT FROM p_ranking_id
      AND c.item_id IS NOT DISTINCT FROM p_item_id
      AND (
        (c.status = 'visible' AND c.moderation_status IN ('clean', 'suggestive'))
        OR (v_user_id IS NOT NULL AND c.user_id = v_user_id AND c.status = 'hidden' AND c.moderation_status IN ('needs_review', 'blocked'))
        OR (v_user_id IS NOT NULL AND c.user_id = v_user_id AND c.status = 'deleted')
        OR (
          c.status = 'deleted'
          AND EXISTS (
            SELECT 1
            FROM public.comments reply
            WHERE reply.parent_id = c.id
              AND reply.status = 'visible'
              AND reply.moderation_status IN ('clean', 'suggestive')
          )
        )
      )
      AND (
        p_cursor_created_at IS NULL
        OR (c.created_at, c.id) < (p_cursor_created_at, p_cursor_id)
      )
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT v_limit
  )
  SELECT COALESCE(array_agg(id ORDER BY created_at DESC, id DESC), ARRAY[]::UUID[]),
         COUNT(*)::INTEGER,
         (array_agg(created_at ORDER BY created_at DESC, id DESC))[COUNT(*)::INTEGER],
         (array_agg(id ORDER BY created_at DESC, id DESC))[COUNT(*)::INTEGER]
  INTO v_root_ids, v_root_count, v_last_created_at, v_last_id
  FROM root_page;

  IF v_root_count > 0 THEN
    WITH thread_rows AS (
      SELECT c.*, c.id AS root_id, c.created_at AS root_created_at, 0 AS depth
      FROM public.comments c
      WHERE c.id = ANY(v_root_ids)

      UNION ALL

      SELECT reply.*, root.id AS root_id, root.created_at AS root_created_at, 1 AS depth
      FROM public.comments reply
      JOIN public.comments root ON root.id = reply.parent_id
      WHERE root.id = ANY(v_root_ids)
        AND (
          (reply.status = 'visible' AND reply.moderation_status IN ('clean', 'suggestive'))
          OR (v_user_id IS NOT NULL AND reply.user_id = v_user_id AND reply.status = 'hidden' AND reply.moderation_status IN ('needs_review', 'blocked'))
          OR (v_user_id IS NOT NULL AND reply.user_id = v_user_id AND reply.status = 'deleted')
          OR reply.status = 'deleted'
        )
    ), safe_rows AS (
      SELECT tr.root_id,
             tr.root_created_at,
             tr.depth,
             tr.id,
             tr.parent_id,
             CASE
               WHEN tr.status = 'deleted' THEN '삭제된 댓글입니다.'
               WHEN tr.moderation_status = 'blocked' THEN '운영 정책에 따라 숨겨진 댓글입니다.'
               ELSE tr.body
             END AS display_body,
             CASE
               WHEN tr.status = 'deleted' THEN 'deleted'
               WHEN tr.moderation_status = 'blocked' THEN 'blocked'
               WHEN tr.moderation_status = 'needs_review' THEN 'needs_review'
               ELSE 'visible'
             END AS presentation_status,
             tr.created_at,
             tr.updated_at,
             tr.updated_at > tr.created_at AS edited,
             v_user_id IS NOT NULL AND tr.user_id = v_user_id AS is_mine,
             CASE WHEN tr.status = 'deleted' THEN NULL ELSE p.display_name END AS display_name,
             CASE WHEN tr.status = 'deleted' THEN NULL ELSE p.avatar_url END AS avatar_url
      FROM thread_rows tr
      LEFT JOIN public.profiles p ON p.id = tr.user_id
    )
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'parent_id', s.parent_id,
          'body', s.display_body,
          'status', s.presentation_status,
          'created_at', s.created_at,
          'updated_at', s.updated_at,
          'edited', s.edited,
          'is_mine', s.is_mine,
          'author', jsonb_build_object(
            'display_name', s.display_name,
            'avatar_url', s.avatar_url
          )
        )
        ORDER BY s.root_created_at DESC, s.root_id DESC, s.depth, s.created_at, s.id
      ),
      '[]'::JSONB
    )
    INTO v_comments
    FROM safe_rows s;
  END IF;

  RETURN jsonb_build_object(
    'comments', v_comments,
    'next_cursor', CASE
      WHEN v_root_count = v_limit THEN jsonb_build_object(
        'created_at', v_last_created_at,
        'id', v_last_id
      )
      ELSE NULL
    END,
    'authenticated', v_user_id IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_ranking_comments(
  p_ranking_id UUID,
  p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.list_content_comments(
    p_ranking_id,
    NULL,
    p_cursor_created_at,
    p_cursor_id,
    p_limit
  );
$$;

CREATE OR REPLACE FUNCTION public.list_item_comments(
  p_item_id UUID,
  p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.list_content_comments(
    NULL,
    p_item_id,
    p_cursor_created_at,
    p_cursor_id,
    p_limit
  );
$$;

CREATE OR REPLACE FUNCTION public.list_comment_moderation_queue(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  comment_id UUID,
  body TEXT,
  lifecycle_status TEXT,
  moderation_status TEXT,
  moderation_reason TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  author_display_name TEXT,
  author_avatar_url TEXT,
  target_type TEXT,
  target_id UUID,
  target_title TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.id,
         c.body,
         c.status,
         c.moderation_status,
         c.moderation_reason,
         c.created_at,
         c.updated_at,
         p.display_name,
         p.avatar_url,
         CASE WHEN c.ranking_id IS NOT NULL THEN 'ranking' ELSE 'item' END,
         COALESCE(c.ranking_id, c.item_id),
         COALESCE(r.title, i.title)
  FROM public.comments c
  JOIN public.profiles p ON p.id = c.user_id
  LEFT JOIN public.rankings r ON r.id = c.ranking_id
  LEFT JOIN public.items i ON i.id = c.item_id
  WHERE c.status <> 'deleted'
    AND c.moderation_status IN ('needs_review', 'blocked')
  ORDER BY c.created_at ASC, c.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION private.normalize_comment_body(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.evaluate_comment_moderation(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enforce_comment_rate(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.lock_public_comment_target(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.create_content_comment(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.list_content_comments(UUID, UUID, TIMESTAMPTZ, UUID, INTEGER) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_ranking_comment(UUID, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_item_comment(UUID, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_own_comment(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_own_comment(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ranking_comment(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_item_comment(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_comment(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_comment(UUID, TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.list_ranking_comments(UUID, TIMESTAMPTZ, UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_item_comments(UUID, TIMESTAMPTZ, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_ranking_comments(UUID, TIMESTAMPTZ, UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_item_comments(UUID, TIMESTAMPTZ, UUID, INTEGER) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.list_comment_moderation_queue(INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_comment_moderation_queue(INTEGER, INTEGER) TO authenticated;

COMMIT;
