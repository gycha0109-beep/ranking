BEGIN;

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
  v_candidate_ids UUID[] := ARRAY[]::UUID[];
  v_root_ids UUID[] := ARRAY[]::UUID[];
  v_root_count INTEGER := 0;
  v_has_more BOOLEAN := FALSE;
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

  WITH eligible_roots AS (
    SELECT c.id, c.created_at
    FROM public.comments c
    WHERE c.parent_id IS NULL
      AND c.ranking_id IS NOT DISTINCT FROM p_ranking_id
      AND c.item_id IS NOT DISTINCT FROM p_item_id
      AND (
        (c.status = 'visible' AND c.moderation_status IN ('clean', 'suggestive'))
        OR (
          v_user_id IS NOT NULL
          AND c.user_id = v_user_id
          AND c.status = 'hidden'
          AND c.moderation_status IN ('needs_review', 'blocked')
        )
        OR (
          v_user_id IS NOT NULL
          AND c.user_id = v_user_id
          AND c.status = 'deleted'
        )
        OR (
          c.status = 'deleted'
          AND EXISTS (
            SELECT 1
            FROM public.comments reply
            WHERE reply.parent_id = c.id
              AND (
                (reply.status = 'visible' AND reply.moderation_status IN ('clean', 'suggestive'))
                OR reply.status = 'deleted'
              )
          )
        )
      )
      AND (
        p_cursor_created_at IS NULL
        OR (c.created_at, c.id) < (p_cursor_created_at, p_cursor_id)
      )
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT v_limit + 1
  )
  SELECT COALESCE(array_agg(id ORDER BY created_at DESC, id DESC), ARRAY[]::UUID[])
  INTO v_candidate_ids
  FROM eligible_roots;

  v_has_more := cardinality(v_candidate_ids) > v_limit;

  IF cardinality(v_candidate_ids) > 0 THEN
    v_root_ids := v_candidate_ids[1:LEAST(cardinality(v_candidate_ids), v_limit)];
  END IF;

  v_root_count := COALESCE(cardinality(v_root_ids), 0);

  IF v_root_count > 0 THEN
    v_last_id := v_root_ids[v_root_count];

    SELECT c.created_at
    INTO v_last_created_at
    FROM public.comments c
    WHERE c.id = v_last_id;

    WITH thread_rows AS (
      SELECT c.id,
             c.user_id,
             c.parent_id,
             c.body,
             c.status,
             c.moderation_status,
             c.created_at,
             c.updated_at,
             c.id AS root_id,
             c.created_at AS root_created_at,
             0 AS depth
      FROM public.comments c
      WHERE c.id = ANY(v_root_ids)

      UNION ALL

      SELECT reply.id,
             reply.user_id,
             reply.parent_id,
             reply.body,
             reply.status,
             reply.moderation_status,
             reply.created_at,
             reply.updated_at,
             root.id AS root_id,
             root.created_at AS root_created_at,
             1 AS depth
      FROM public.comments reply
      JOIN public.comments root ON root.id = reply.parent_id
      WHERE root.id = ANY(v_root_ids)
        AND (
          (reply.status = 'visible' AND reply.moderation_status IN ('clean', 'suggestive'))
          OR (
            v_user_id IS NOT NULL
            AND reply.user_id = v_user_id
            AND reply.status = 'hidden'
            AND reply.moderation_status IN ('needs_review', 'blocked')
          )
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
      WHEN v_has_more THEN jsonb_build_object(
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

REVOKE ALL ON FUNCTION private.list_content_comments(UUID, UUID, TIMESTAMPTZ, UUID, INTEGER)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.list_ranking_comments(UUID, TIMESTAMPTZ, UUID, INTEGER)
FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_item_comments(UUID, TIMESTAMPTZ, UUID, INTEGER)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_ranking_comments(UUID, TIMESTAMPTZ, UUID, INTEGER)
TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_item_comments(UUID, TIMESTAMPTZ, UUID, INTEGER)
TO anon, authenticated;

REVOKE ALL ON FUNCTION public.list_comment_moderation_queue(INTEGER, INTEGER)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_comment_moderation_queue(INTEGER, INTEGER)
TO authenticated;

COMMIT;
