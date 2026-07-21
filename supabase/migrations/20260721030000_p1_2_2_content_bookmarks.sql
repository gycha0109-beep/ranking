BEGIN;

CREATE TABLE public.content_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ranking_id UUID REFERENCES public.rankings(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_bookmarks_exactly_one_target CHECK (num_nonnulls(ranking_id, item_id) = 1)
);

CREATE UNIQUE INDEX uq_content_bookmarks_user_ranking
  ON public.content_bookmarks(user_id, ranking_id)
  WHERE ranking_id IS NOT NULL;

CREATE UNIQUE INDEX uq_content_bookmarks_user_item
  ON public.content_bookmarks(user_id, item_id)
  WHERE item_id IS NOT NULL;

CREATE INDEX idx_content_bookmarks_user_created
  ON public.content_bookmarks(user_id, created_at DESC);

CREATE INDEX idx_content_bookmarks_ranking
  ON public.content_bookmarks(ranking_id)
  WHERE ranking_id IS NOT NULL;

CREATE INDEX idx_content_bookmarks_item
  ON public.content_bookmarks(item_id)
  WHERE item_id IS NOT NULL;

CREATE TABLE public.content_bookmark_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ranking_id UUID REFERENCES public.rankings(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  requested_bookmarked BOOLEAN NOT NULL,
  changed BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_bookmark_events_exactly_one_target CHECK (num_nonnulls(ranking_id, item_id) = 1)
);

CREATE INDEX idx_content_bookmark_events_user_created
  ON public.content_bookmark_events(user_id, created_at DESC);

ALTER TABLE public.content_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_bookmark_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.content_bookmarks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.content_bookmark_events FROM PUBLIC, anon, authenticated;

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
    user_id,
    ranking_id,
    item_id,
    requested_bookmarked,
    changed
  ) VALUES (
    v_user_id,
    p_ranking_id,
    p_item_id,
    p_bookmarked,
    v_changed
  );

  RETURN jsonb_build_object(
    'bookmarked', p_bookmarked,
    'changed', v_changed
  );
END;
$$;

REVOKE ALL ON FUNCTION private.set_content_bookmark(UUID, UUID, BOOLEAN)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_ranking_bookmark(
  p_ranking_id UUID,
  p_bookmarked BOOLEAN
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.set_content_bookmark(p_ranking_id, NULL, p_bookmarked);
$$;

CREATE OR REPLACE FUNCTION public.set_item_bookmark(
  p_item_id UUID,
  p_bookmarked BOOLEAN
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.set_content_bookmark(NULL, p_item_id, p_bookmarked);
$$;

CREATE OR REPLACE FUNCTION public.get_ranking_bookmark_state(p_ranking_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF NOT private.is_public_ranking(p_ranking_id) THEN
    RAISE EXCEPTION '공개된 랭킹을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.content_bookmarks
    WHERE user_id = v_user_id
      AND ranking_id = p_ranking_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_item_bookmark_state(p_item_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF NOT private.is_public_item(p_item_id) THEN
    RAISE EXCEPTION '공개된 아이템을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.content_bookmarks
    WHERE user_id = v_user_id
      AND item_id = p_item_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_bookmarks(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  target_type TEXT,
  target_id UUID,
  title TEXT,
  slug TEXT,
  summary TEXT,
  image_url TEXT,
  bookmarked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT result.target_type,
         result.target_id,
         result.title,
         result.slug,
         result.summary,
         result.image_url,
         result.bookmarked_at
  FROM (
    SELECT 'ranking'::TEXT AS target_type,
           r.id AS target_id,
           r.title,
           r.slug,
           r.summary,
           r.cover_image_url AS image_url,
           b.created_at AS bookmarked_at
    FROM public.content_bookmarks b
    JOIN public.rankings r ON r.id = b.ranking_id
    WHERE b.user_id = v_user_id
      AND b.ranking_id IS NOT NULL
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')

    UNION ALL

    SELECT 'item'::TEXT AS target_type,
           i.id AS target_id,
           i.title,
           i.slug,
           i.description AS summary,
           i.image_url,
           b.created_at AS bookmarked_at
    FROM public.content_bookmarks b
    JOIN public.items i ON i.id = b.item_id
    WHERE b.user_id = v_user_id
      AND b.item_id IS NOT NULL
      AND private.is_public_item(i.id)
  ) AS result
  ORDER BY result.bookmarked_at DESC, result.target_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.set_ranking_bookmark(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_item_bookmark(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_ranking_bookmark_state(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_item_bookmark_state(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_bookmarks(INTEGER, INTEGER) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_ranking_bookmark(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_item_bookmark(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_bookmark_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_item_bookmark_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_bookmarks(INTEGER, INTEGER) TO authenticated;

COMMIT;
