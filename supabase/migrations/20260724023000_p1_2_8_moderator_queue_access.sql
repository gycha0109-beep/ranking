BEGIN;

DROP POLICY IF EXISTS "Admins can view moderation reviews" ON public.moderation_reviews;
CREATE POLICY "Operators can view moderation reviews"
ON public.moderation_reviews
FOR SELECT
TO authenticated
USING (private.has_admin_capability(auth.uid(),'moderation_review'));

CREATE OR REPLACE FUNCTION public.list_comment_moderation_queue(p_limit INTEGER DEFAULT 50,p_offset INTEGER DEFAULT 0)
RETURNS TABLE(comment_id UUID,body TEXT,lifecycle_status TEXT,moderation_status TEXT,moderation_reason TEXT,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ,author_display_name TEXT,author_avatar_url TEXT,target_type TEXT,target_id UUID,target_slug TEXT,target_title TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,auth,private,pg_temp AS $$
BEGIN
  PERFORM private.assert_admin_capability('moderation_review');
  RETURN QUERY
  SELECT c.id,c.body,c.status,c.moderation_status,c.moderation_reason,c.created_at,c.updated_at,
         p.display_name,p.avatar_url,
         CASE WHEN c.ranking_id IS NOT NULL THEN 'ranking' ELSE 'item' END,
         COALESCE(c.ranking_id,c.item_id),COALESCE(r.slug,i.slug),COALESCE(r.title,i.title)
  FROM public.comments c
  JOIN public.profiles p ON p.id=c.user_id
  LEFT JOIN public.rankings r ON r.id=c.ranking_id
  LEFT JOIN public.items i ON i.id=c.item_id
  WHERE c.status<>'deleted' AND c.moderation_status IN ('needs_review','blocked')
  ORDER BY c.created_at ASC,c.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),100)
  OFFSET GREATEST(COALESCE(p_offset,0),0);
END; $$;

COMMIT;