BEGIN;

CREATE OR REPLACE FUNCTION public.admin_impose_user_sanction(
  p_target_user_id UUID,
  p_sanction_type TEXT,
  p_reason TEXT,
  p_admin_note TEXT,
  p_duration_hours INTEGER DEFAULT NULL,
  p_source_comment_id UUID DEFAULT NULL,
  p_source_report_decision_id BIGINT DEFAULT NULL,
  p_source_moderation_review_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth,private,pg_temp AS $$
DECLARE v_admin_id UUID:=auth.uid(); v_type TEXT:=LOWER(BTRIM(COALESCE(p_sanction_type,''))); v_sanction_id UUID; v_sanction public.user_sanctions%ROWTYPE;
BEGIN
  IF v_type='warning' THEN
    PERFORM private.assert_admin_capability('sanction_impose_warning');
  ELSIF v_type='account_suspension' AND COALESCE(p_duration_hours,0)>168 THEN
    PERFORM private.assert_admin_capability('sanction_impose_long_suspension');
  ELSE
    PERFORM private.assert_admin_capability('sanction_impose_restriction');
  END IF;
  v_sanction_id:=private.create_user_sanction_record(p_target_user_id,v_type,p_duration_hours,p_reason,p_admin_note,v_admin_id,p_source_comment_id,p_source_report_decision_id,p_source_moderation_review_id,TRUE);
  SELECT * INTO v_sanction FROM public.user_sanctions WHERE id=v_sanction_id;
  RETURN jsonb_build_object('sanction_id',v_sanction.id,'sanction_type',v_sanction.sanction_type,'starts_at',v_sanction.starts_at,'ends_at',v_sanction.ends_at,'state','active');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_user_sanction(p_sanction_id UUID,p_note TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth,private,pg_temp AS $$
DECLARE v_admin_id UUID:=auth.uid(); v_event_id BIGINT;
BEGIN
  PERFORM private.assert_admin_capability('sanction_revoke');
  IF EXISTS(SELECT 1 FROM public.user_sanction_appeals a LEFT JOIN public.user_sanction_appeal_decisions d ON d.appeal_id=a.id WHERE a.sanction_id=p_sanction_id AND d.id IS NULL) THEN
    RAISE EXCEPTION '처리 대기 중인 이의제기가 있습니다. 이의제기 검토 화면에서 결정해 주세요.' USING ERRCODE='P0004';
  END IF;
  v_event_id:=private.end_user_sanction_record(p_sanction_id,'revoked',v_admin_id,p_note,TRUE);
  RETURN jsonb_build_object('sanction_id',p_sanction_id,'event_id',v_event_id,'state','revoked');
END; $$;

CREATE OR REPLACE FUNCTION public.review_user_sanction_appeal(p_appeal_id UUID,p_decision TEXT,p_review_note TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth,private,pg_temp AS $$
DECLARE v_admin_id UUID:=auth.uid(); v_decision TEXT:=LOWER(private.normalize_sanction_text(p_decision)); v_note TEXT:=private.normalize_sanction_text(p_review_note); v_appeal public.user_sanction_appeals%ROWTYPE; v_decision_id BIGINT; v_created_at TIMESTAMPTZ;
BEGIN
  IF v_decision='accepted' THEN PERFORM private.assert_admin_capability('appeal_accept'); ELSE PERFORM private.assert_admin_capability('appeal_reject'); END IF;
  IF v_decision NOT IN ('accepted','rejected') THEN RAISE EXCEPTION '이의제기 처리 결과가 올바르지 않습니다.' USING ERRCODE='22023'; END IF;
  IF char_length(v_note) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION '이의제기 검토 메모는 10자 이상 2,000자 이하로 입력해 주세요.' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('user-sanction-appeal-review:'||p_appeal_id::TEXT,0));
  SELECT * INTO v_appeal FROM public.user_sanction_appeals WHERE id=p_appeal_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION '이의제기를 찾을 수 없습니다.' USING ERRCODE='P0002'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_sanction_appeal_decisions WHERE appeal_id=p_appeal_id) THEN RAISE EXCEPTION '이미 처리된 이의제기입니다.' USING ERRCODE='P0004'; END IF;
  IF v_decision='accepted' THEN PERFORM private.end_user_sanction_record(v_appeal.sanction_id,'overturned',v_admin_id,v_note,FALSE); END IF;
  INSERT INTO public.user_sanction_appeal_decisions(appeal_id,decision,reviewed_by,review_note)
  VALUES(p_appeal_id,v_decision,v_admin_id,v_note) RETURNING id,created_at INTO v_decision_id,v_created_at;
  PERFORM private.emit_notification(v_appeal.appellant_id,'user_sanction_appeal_resolved','user-sanction-appeal:'||p_appeal_id::TEXT,v_admin_id,NULL,NULL,NULL,NULL,v_decision);
  RETURN jsonb_build_object('appeal_id',p_appeal_id,'appeal_decision_id',v_decision_id,'decision',v_decision,'sanction_state',CASE WHEN v_decision='accepted' THEN 'overturned' ELSE NULL END,'created_at',v_created_at);
END; $$;

CREATE OR REPLACE FUNCTION public.list_admin_audit_events(p_limit INTEGER DEFAULT 100,p_offset INTEGER DEFAULT 0)
RETURNS TABLE(event_kind TEXT,event_id TEXT,actor_display_name TEXT,target_label TEXT,action TEXT,details JSONB,created_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,auth,private,pg_temp AS $$
BEGIN
  PERFORM private.assert_admin_capability('audit_view');
  RETURN QUERY
  SELECT x.event_kind,x.event_id,x.actor_display_name,x.target_label,x.action,x.details,x.created_at
  FROM (
    SELECT 'role_change'::TEXT,e.id::TEXT,ap.display_name,COALESCE(tp.display_name,e.target_user_id::TEXT),e.previous_level||' → '||e.new_level,jsonb_build_object('reason',e.reason),e.created_at
    FROM public.admin_role_change_events e LEFT JOIN public.profiles ap ON ap.id=e.actor_id LEFT JOIN public.profiles tp ON tp.id=e.target_user_id
    UNION ALL
    SELECT 'moderation_review',mr.id::TEXT,rp.display_name,mr.entity_type||':'||mr.entity_id::TEXT,mr.decision_status,jsonb_build_object('previous_status',mr.previous_status,'reason',mr.decision_reason,'note',mr.review_note),mr.reviewed_at
    FROM public.moderation_reviews mr LEFT JOIN public.profiles rp ON rp.id=mr.reviewed_by WHERE mr.decision_source='manual'
    UNION ALL
    SELECT 'comment_report_decision',d.id::TEXT,rp.display_name,'comment:'||d.comment_id::TEXT,d.resolution,jsonb_build_object('author_action',d.author_action,'reason',d.decision_reason,'note',d.review_note),d.created_at
    FROM public.comment_report_decisions d LEFT JOIN public.profiles rp ON rp.id=d.reviewed_by
    UNION ALL
    SELECT 'sanction_event',se.id::TEXT,ap.display_name,COALESCE(tp.display_name,us.target_user_id::TEXT),se.event_type,jsonb_build_object('sanction_type',us.sanction_type,'note',se.note),se.created_at
    FROM public.user_sanction_events se JOIN public.user_sanctions us ON us.id=se.sanction_id LEFT JOIN public.profiles ap ON ap.id=se.actor_id LEFT JOIN public.profiles tp ON tp.id=us.target_user_id
    UNION ALL
    SELECT 'appeal_decision',ad.id::TEXT,rp.display_name,COALESCE(tp.display_name,a.appellant_id::TEXT),ad.decision,jsonb_build_object('review_note',ad.review_note,'sanction_id',a.sanction_id),ad.created_at
    FROM public.user_sanction_appeal_decisions ad JOIN public.user_sanction_appeals a ON a.id=ad.appeal_id LEFT JOIN public.profiles rp ON rp.id=ad.reviewed_by LEFT JOIN public.profiles tp ON tp.id=a.appellant_id
  ) x
  ORDER BY x.created_at DESC,x.event_kind,x.event_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),200) OFFSET GREATEST(COALESCE(p_offset,0),0);
END; $$;

REVOKE ALL ON FUNCTION public.list_admin_audit_events(INTEGER,INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_admin_audit_events(INTEGER,INTEGER) TO authenticated;

COMMIT;