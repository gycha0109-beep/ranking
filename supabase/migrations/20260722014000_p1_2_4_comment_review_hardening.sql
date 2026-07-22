BEGIN;

CREATE INDEX IF NOT EXISTS idx_comments_ranking_public_count
  ON public.comments(ranking_id)
  WHERE status = 'visible'
    AND moderation_status IN ('clean', 'suggestive');

CREATE INDEX IF NOT EXISTS idx_comments_item_public_count
  ON public.comments(item_id)
  WHERE status = 'visible'
    AND moderation_status IN ('clean', 'suggestive');

CREATE OR REPLACE FUNCTION public.get_ranking_public_comment_count(p_ranking_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_count BIGINT := 0;
BEGIN
  IF NOT private.is_public_ranking(p_ranking_id) THEN
    RAISE EXCEPTION '공개된 랭킹을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.comments c
  WHERE c.ranking_id = p_ranking_id
    AND c.status = 'visible'
    AND c.moderation_status IN ('clean', 'suggestive');

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_item_public_comment_count(p_item_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_count BIGINT := 0;
BEGIN
  IF NOT private.is_public_item(p_item_id) THEN
    RAISE EXCEPTION '공개된 아이템을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.comments c
  WHERE c.item_id = p_item_id
    AND c.status = 'visible'
    AND c.moderation_status IN ('clean', 'suggestive');

  RETURN v_count;
END;
$$;

DROP FUNCTION public.list_comment_moderation_queue(INTEGER, INTEGER);

CREATE FUNCTION public.list_comment_moderation_queue(
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
  target_slug TEXT,
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
         COALESCE(r.slug, i.slug),
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

REVOKE ALL ON FUNCTION public.get_ranking_public_comment_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_item_public_comment_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ranking_public_comment_count(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_item_public_comment_count(UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.list_comment_moderation_queue(INTEGER, INTEGER)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_comment_moderation_queue(INTEGER, INTEGER)
TO authenticated;

COMMIT;
