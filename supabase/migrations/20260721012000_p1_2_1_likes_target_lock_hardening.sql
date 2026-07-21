BEGIN;

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

COMMIT;
