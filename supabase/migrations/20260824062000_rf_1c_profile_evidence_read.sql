BEGIN;

CREATE OR REPLACE FUNCTION public.get_rf1_my_profile_events(
  p_since TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  event_id TEXT,
  event_type TEXT,
  occurred_at TIMESTAMPTZ,
  ranking_id UUID,
  item_id UUID,
  category_id UUID,
  subcategory_id UUID,
  ranking_type TEXT,
  ranking_item_ids UUID[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, private, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 1000);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;
  IF p_since IS NULL THEN
    RAISE EXCEPTION 'RF-1 profile window start is required' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH selected_events AS (
    SELECT e.*
    FROM public.content_bookmark_events e
    WHERE e.user_id = v_user_id
      AND e.changed = TRUE
      AND e.created_at >= p_since
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT v_limit
  )
  SELECT
    'bookmark:' || e.id::TEXT AS event_id,
    CASE WHEN e.requested_bookmarked THEN 'SAVE'::TEXT ELSE 'UNSAVE'::TEXT END AS event_type,
    e.created_at AS occurred_at,
    e.ranking_id,
    e.item_id,
    r.category_id,
    r.subcategory_id,
    r.ranking_type,
    CASE
      WHEN e.ranking_id IS NOT NULL THEN COALESCE(items.item_ids, ARRAY[]::UUID[])
      ELSE ARRAY[]::UUID[]
    END AS ranking_item_ids
  FROM selected_events e
  LEFT JOIN public.rankings r
    ON r.id = e.ranking_id
    AND r.status = 'published'
    AND r.moderation_status IN ('clean', 'suggestive')
    AND r.image_moderation_status IN ('clean', 'suggestive')
  LEFT JOIN LATERAL (
    SELECT array_agg(re.item_id ORDER BY re.position, re.id) AS item_ids
    FROM public.ranking_entries re
    JOIN public.items i ON i.id = re.item_id
    WHERE re.ranking_id = e.ranking_id
      AND re.moderation_status IN ('clean', 'suggestive')
      AND i.status = 'active'
      AND i.moderation_status IN ('clean', 'suggestive')
      AND i.image_moderation_status IN ('clean', 'suggestive')
  ) items ON TRUE
  WHERE (
    (e.ranking_id IS NOT NULL AND r.id IS NOT NULL)
    OR
    (e.item_id IS NOT NULL AND private.is_public_item(e.item_id))
  )
  ORDER BY e.created_at ASC, e.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_rf1_my_profile_events(TIMESTAMPTZ, INTEGER)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_rf1_my_profile_events(TIMESTAMPTZ, INTEGER)
TO authenticated;

COMMIT;
