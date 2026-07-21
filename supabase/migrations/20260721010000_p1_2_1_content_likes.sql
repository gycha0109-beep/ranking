BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE public.content_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ranking_id UUID REFERENCES public.rankings(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_likes_exactly_one_target CHECK (num_nonnulls(ranking_id, item_id) = 1)
);

CREATE UNIQUE INDEX uq_content_likes_user_ranking
  ON public.content_likes(user_id, ranking_id)
  WHERE ranking_id IS NOT NULL;

CREATE UNIQUE INDEX uq_content_likes_user_item
  ON public.content_likes(user_id, item_id)
  WHERE item_id IS NOT NULL;

CREATE INDEX idx_content_likes_ranking
  ON public.content_likes(ranking_id)
  WHERE ranking_id IS NOT NULL;

CREATE INDEX idx_content_likes_item
  ON public.content_likes(item_id)
  WHERE item_id IS NOT NULL;

CREATE TABLE public.content_like_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ranking_id UUID REFERENCES public.rankings(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  requested_liked BOOLEAN NOT NULL,
  changed BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_like_events_exactly_one_target CHECK (num_nonnulls(ranking_id, item_id) = 1)
);

CREATE INDEX idx_content_like_events_user_created
  ON public.content_like_events(user_id, created_at DESC);

ALTER TABLE public.content_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_like_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.content_likes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.content_like_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_public_ranking(p_ranking_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rankings r
    WHERE r.id = p_ranking_id
      AND r.status = 'published'
      AND r.moderation_status IN ('clean', 'suggestive')
      AND r.image_moderation_status IN ('clean', 'suggestive')
  );
$$;

CREATE OR REPLACE FUNCTION private.is_public_item(p_item_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.items i
    WHERE i.id = p_item_id
      AND i.status = 'active'
      AND i.moderation_status IN ('clean', 'suggestive')
      AND i.image_moderation_status IN ('clean', 'suggestive')
      AND EXISTS (
        SELECT 1
        FROM public.ranking_entries e
        JOIN public.rankings r ON r.id = e.ranking_id
        WHERE e.item_id = i.id
          AND e.moderation_status IN ('clean', 'suggestive')
          AND r.status = 'published'
          AND r.moderation_status IN ('clean', 'suggestive')
          AND r.image_moderation_status IN ('clean', 'suggestive')
      )
  );
$$;

REVOKE ALL ON FUNCTION private.is_public_ranking(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_public_item(UUID) FROM PUBLIC, anon, authenticated;

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

  IF num_nonnulls(p_ranking_id, p_item_id) <> 1 THEN
    RAISE EXCEPTION '좋아요 대상이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;

  IF p_ranking_id IS NOT NULL AND NOT private.is_public_ranking(p_ranking_id) THEN
    RAISE EXCEPTION '공개된 랭킹만 좋아요할 수 있습니다.' USING ERRCODE = 'P0002';
  END IF;

  IF p_item_id IS NOT NULL AND NOT private.is_public_item(p_item_id) THEN
    RAISE EXCEPTION '공개 랭킹에 연결된 활성 아이템만 좋아요할 수 있습니다.' USING ERRCODE = 'P0002';
  END IF;

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
    hashtextextended('content-like:' || v_user_id::TEXT || ':' || v_target_key, 0)
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

  INSERT INTO public.content_like_events(user_id, ranking_id, item_id, requested_liked, changed)
  VALUES(v_user_id, p_ranking_id, p_item_id, p_liked, v_changed);

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

REVOKE ALL ON FUNCTION private.set_content_like(UUID, UUID, BOOLEAN)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_ranking_like(
  p_ranking_id UUID,
  p_liked BOOLEAN
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.set_content_like(p_ranking_id, NULL, p_liked);
$$;

CREATE OR REPLACE FUNCTION public.set_item_like(
  p_item_id UUID,
  p_liked BOOLEAN
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
  SELECT private.set_content_like(NULL, p_item_id, p_liked);
$$;

CREATE OR REPLACE FUNCTION public.get_ranking_like_summary(p_ranking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count BIGINT;
  v_liked BOOLEAN := FALSE;
BEGIN
  IF NOT private.is_public_ranking(p_ranking_id) THEN
    RAISE EXCEPTION '공개된 랭킹을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.content_likes
  WHERE ranking_id = p_ranking_id;

  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.content_likes
      WHERE user_id = v_user_id AND ranking_id = p_ranking_id
    ) INTO v_liked;
  END IF;

  RETURN jsonb_build_object('liked', v_liked, 'like_count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_item_like_summary(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count BIGINT;
  v_liked BOOLEAN := FALSE;
BEGIN
  IF NOT private.is_public_item(p_item_id) THEN
    RAISE EXCEPTION '공개된 아이템을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.content_likes
  WHERE item_id = p_item_id;

  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.content_likes
      WHERE user_id = v_user_id AND item_id = p_item_id
    ) INTO v_liked;
  END IF;

  RETURN jsonb_build_object('liked', v_liked, 'like_count', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.set_ranking_like(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_item_like(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_ranking_like(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_item_like(UUID, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.get_ranking_like_summary(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_item_like_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ranking_like_summary(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_item_like_summary(UUID) TO anon, authenticated;

COMMIT;
