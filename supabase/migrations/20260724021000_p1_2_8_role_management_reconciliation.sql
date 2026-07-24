BEGIN;

CREATE OR REPLACE FUNCTION private.has_admin_capability(p_user_id UUID,p_capability TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_level TEXT; v_capability TEXT:=LOWER(BTRIM(COALESCE(p_capability,'')));
BEGIN
  IF p_user_id IS NULL THEN RETURN FALSE; END IF;
  v_level:=private.get_admin_role_level(p_user_id);
  IF v_capability IN ('admin_console_access','moderation_review') THEN RETURN v_level IN ('moderator','admin','super_admin'); END IF;
  IF v_capability IN ('report_review','sanction_view','sanction_impose_warning','content_manage','sanction_impose_restriction','appeal_reject','audit_view') THEN RETURN v_level IN ('admin','super_admin'); END IF;
  IF v_capability IN ('sanction_impose_long_suspension','sanction_revoke','appeal_accept','role_manage') THEN RETURN v_level='super_admin'; END IF;
  RETURN FALSE;
END; $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=auth,private,pg_temp AS $$
  SELECT private.get_admin_role_level(auth.uid()) IN ('admin','super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_operator()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=auth,private,pg_temp AS $$
  SELECT private.has_admin_capability(auth.uid(),'admin_console_access');
$$;

CREATE OR REPLACE FUNCTION private.set_admin_role_level(p_target_user_id UUID,p_new_level TEXT,p_actor_id UUID,p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_new_level TEXT:=LOWER(BTRIM(COALESCE(p_new_level,''))); v_reason TEXT:=regexp_replace(BTRIM(COALESCE(p_reason,'')),'[[:space:]]+',' ','g'); v_previous_level TEXT; v_super_count INTEGER;
BEGIN
  IF NOT private.has_admin_capability(p_actor_id,'role_manage') THEN RAISE EXCEPTION '최고 관리자 권한이 필요합니다.' USING ERRCODE='42501'; END IF;
  IF p_target_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_target_user_id) THEN RAISE EXCEPTION '대상 사용자를 찾을 수 없습니다.' USING ERRCODE='P0002'; END IF;
  IF p_target_user_id=p_actor_id THEN RAISE EXCEPTION '자기 자신의 운영 역할은 변경할 수 없습니다.' USING ERRCODE='42501'; END IF;
  IF v_new_level NOT IN ('none','moderator','admin','super_admin') THEN RAISE EXCEPTION '운영 역할 수준이 올바르지 않습니다.' USING ERRCODE='22023'; END IF;
  IF char_length(v_reason) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION '역할 변경 사유는 10자 이상 2,000자 이하로 입력해 주세요.' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('admin-role:'||p_target_user_id::TEXT,0));
  v_previous_level:=private.get_admin_role_level(p_target_user_id);
  IF v_previous_level=v_new_level THEN RAISE EXCEPTION '이미 동일한 운영 역할이 부여되어 있습니다.' USING ERRCODE='P0004'; END IF;
  IF v_previous_level='super_admin' AND v_new_level<>'super_admin' THEN
    SELECT COUNT(DISTINCT user_id)::INTEGER INTO v_super_count FROM public.user_roles WHERE role='super_admin';
    IF v_super_count<=1 THEN RAISE EXCEPTION '마지막 최고 관리자 역할은 제거할 수 없습니다.' USING ERRCODE='P0004'; END IF;
  END IF;
  DELETE FROM public.user_roles WHERE user_id=p_target_user_id AND role IN ('moderator','admin','super_admin');
  IF v_new_level IN ('moderator','admin','super_admin') THEN INSERT INTO public.user_roles(user_id,role) VALUES(p_target_user_id,'moderator') ON CONFLICT DO NOTHING; END IF;
  IF v_new_level IN ('admin','super_admin') THEN INSERT INTO public.user_roles(user_id,role) VALUES(p_target_user_id,'admin') ON CONFLICT DO NOTHING; END IF;
  IF v_new_level='super_admin' THEN INSERT INTO public.user_roles(user_id,role) VALUES(p_target_user_id,'super_admin') ON CONFLICT DO NOTHING; END IF;
  INSERT INTO public.admin_role_change_events(target_user_id,previous_level,new_level,actor_id,reason) VALUES(p_target_user_id,v_previous_level,v_new_level,p_actor_id,v_reason);
  RETURN jsonb_build_object('target_user_id',p_target_user_id,'previous_level',v_previous_level,'new_level',v_new_level);
END; $$;

CREATE OR REPLACE FUNCTION public.set_admin_role_level(p_target_user_id UUID,p_new_level TEXT,p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=auth,private,pg_temp AS $$ BEGIN RETURN private.set_admin_role_level(p_target_user_id,p_new_level,auth.uid(),p_reason); END; $$;

CREATE OR REPLACE FUNCTION public.search_admin_role_candidates(p_query TEXT,p_limit INTEGER DEFAULT 20)
RETURNS TABLE(user_id UUID,display_name TEXT,current_level TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,auth,private,pg_temp AS $$
DECLARE v_query TEXT:=BTRIM(COALESCE(p_query,''));
BEGIN
  PERFORM private.assert_admin_capability('role_manage');
  IF char_length(v_query)<2 THEN RAISE EXCEPTION '검색어는 2자 이상 입력해 주세요.' USING ERRCODE='22023'; END IF;
  RETURN QUERY SELECT p.id,p.display_name,private.get_admin_role_level(p.id) FROM public.profiles p
  WHERE p.display_name ILIKE '%'||v_query||'%' OR p.id::TEXT LIKE v_query||'%'
  ORDER BY CASE WHEN p.id::TEXT=v_query THEN 0 ELSE 1 END,p.display_name,p.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit,20),1),50);
END; $$;

CREATE OR REPLACE FUNCTION public.list_admin_role_change_events(p_limit INTEGER DEFAULT 100,p_offset INTEGER DEFAULT 0)
RETURNS TABLE(event_id BIGINT,target_user_id UUID,target_display_name TEXT,previous_level TEXT,new_level TEXT,actor_display_name TEXT,reason TEXT,created_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,auth,private,pg_temp AS $$
BEGIN
  PERFORM private.assert_admin_capability('audit_view');
  RETURN QUERY SELECT e.id,e.target_user_id,COALESCE(tp.display_name,'알 수 없는 사용자'),e.previous_level,e.new_level,ap.display_name,e.reason,e.created_at
  FROM public.admin_role_change_events e LEFT JOIN public.profiles tp ON tp.id=e.target_user_id LEFT JOIN public.profiles ap ON ap.id=e.actor_id
  ORDER BY e.created_at DESC,e.id DESC LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),200) OFFSET GREATEST(COALESCE(p_offset,0),0);
END; $$;

CREATE OR REPLACE FUNCTION private.apply_moderation_review(p_entity_type TEXT,p_entity_id UUID,p_decision_status TEXT,p_decision_reason TEXT,p_note TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth,private,pg_temp AS $$
DECLARE v_user_id UUID:=auth.uid(); v_previous_status TEXT; v_previous_reason TEXT; v_note TEXT:=NULLIF(BTRIM(COALESCE(p_note,'')),''); v_reason TEXT:=COALESCE(NULLIF(BTRIM(p_decision_reason),''),'none'); v_now TIMESTAMPTZ:=NOW();
BEGIN
  PERFORM private.assert_admin_capability('moderation_review');
  IF p_entity_type NOT IN ('ranking','ranking_entry','item','ranking_image','item_image','comment') THEN RAISE EXCEPTION '지원하지 않는 Moderation 대상입니다.' USING ERRCODE='22023'; END IF;
  IF p_decision_status NOT IN ('clean','suggestive','needs_review','blocked') THEN RAISE EXCEPTION '유효하지 않은 Moderation 상태입니다.' USING ERRCODE='22023'; END IF;
  IF v_reason NOT IN ('sexual_suggestive','explicit_sexual','minor_sexualization','real_person_sexualization','hate','violence','privacy','illegal','spam','none','system_error') THEN RAISE EXCEPTION '유효하지 않은 Moderation 사유입니다.' USING ERRCODE='22023'; END IF;
  IF p_decision_status='clean' THEN v_reason:='none'; END IF;
  CASE p_entity_type
    WHEN 'ranking' THEN SELECT moderation_status,moderation_reason INTO v_previous_status,v_previous_reason FROM public.rankings WHERE id=p_entity_id FOR UPDATE;
    WHEN 'ranking_entry' THEN SELECT moderation_status,moderation_reason INTO v_previous_status,v_previous_reason FROM public.ranking_entries WHERE id=p_entity_id FOR UPDATE;
    WHEN 'item' THEN SELECT moderation_status,moderation_reason INTO v_previous_status,v_previous_reason FROM public.items WHERE id=p_entity_id FOR UPDATE;
    WHEN 'ranking_image' THEN SELECT image_moderation_status,image_moderation_reason INTO v_previous_status,v_previous_reason FROM public.rankings WHERE id=p_entity_id FOR UPDATE;
    WHEN 'item_image' THEN SELECT image_moderation_status,image_moderation_reason INTO v_previous_status,v_previous_reason FROM public.items WHERE id=p_entity_id FOR UPDATE;
    WHEN 'comment' THEN SELECT moderation_status,moderation_reason INTO v_previous_status,v_previous_reason FROM public.comments WHERE id=p_entity_id FOR UPDATE;
  END CASE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Moderation 대상을 찾을 수 없습니다.' USING ERRCODE='P0002'; END IF;
  IF v_previous_status=p_decision_status AND v_note IS NULL THEN RAISE EXCEPTION '동일 상태 재검토에는 검토 메모가 필요합니다.' USING ERRCODE='22023'; END IF;
  IF v_previous_status='blocked' AND p_decision_status IN ('clean','suggestive') AND COALESCE(LENGTH(v_note),0)<10 THEN RAISE EXCEPTION '차단 해제에는 10자 이상의 검토 메모가 필요합니다.' USING ERRCODE='22023'; END IF;
  CASE p_entity_type
    WHEN 'ranking' THEN UPDATE public.rankings SET moderation_status=p_decision_status,moderation_reason=v_reason,moderation_reviewed_by=v_user_id,moderation_reviewed_at=v_now,moderation_review_note=v_note WHERE id=p_entity_id;
    WHEN 'ranking_entry' THEN UPDATE public.ranking_entries SET moderation_status=p_decision_status,moderation_reason=v_reason,moderation_reviewed_by=v_user_id,moderation_reviewed_at=v_now,moderation_review_note=v_note WHERE id=p_entity_id;
    WHEN 'item' THEN UPDATE public.items SET moderation_status=p_decision_status,moderation_reason=v_reason,moderation_reviewed_by=v_user_id,moderation_reviewed_at=v_now,moderation_review_note=v_note WHERE id=p_entity_id;
    WHEN 'ranking_image' THEN UPDATE public.rankings SET image_moderation_status=p_decision_status,image_moderation_reason=v_reason,image_moderation_reviewed_by=v_user_id,image_moderation_reviewed_at=v_now,image_moderation_review_note=v_note WHERE id=p_entity_id;
    WHEN 'item_image' THEN UPDATE public.items SET image_moderation_status=p_decision_status,image_moderation_reason=v_reason,image_moderation_reviewed_by=v_user_id,image_moderation_reviewed_at=v_now,image_moderation_review_note=v_note WHERE id=p_entity_id;
    WHEN 'comment' THEN UPDATE public.comments SET moderation_status=p_decision_status,moderation_reason=v_reason,moderation_reviewed_by=v_user_id,moderation_reviewed_at=v_now,moderation_review_note=v_note WHERE id=p_entity_id;
  END CASE;
  INSERT INTO public.moderation_reviews(entity_type,entity_id,previous_status,previous_reason,decision_status,decision_reason,review_note,decision_source,reviewed_by,reviewed_at)
  VALUES(p_entity_type,p_entity_id,v_previous_status,v_previous_reason,p_decision_status,v_reason,v_note,'manual',v_user_id,v_now);
END; $$;

REVOKE ALL ON FUNCTION private.set_admin_role_level(UUID,TEXT,UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.set_admin_role_level(UUID,TEXT,TEXT) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.set_admin_role_level(UUID,TEXT,TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.search_admin_role_candidates(TEXT,INTEGER) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.search_admin_role_candidates(TEXT,INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.list_admin_role_change_events(INTEGER,INTEGER) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.list_admin_role_change_events(INTEGER,INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.is_operator() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.is_operator() TO authenticated;

COMMIT;