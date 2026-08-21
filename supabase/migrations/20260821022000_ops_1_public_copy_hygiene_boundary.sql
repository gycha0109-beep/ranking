begin;

-- Reconcile the two remaining Production leaks before strengthening the detector.
-- The existing helper misses lifecycle markers immediately followed by Korean text.
do $$
declare
  v_ranking_id uuid;
  v_published_at timestamptz;
  v_italy_count integer;
  v_china_count integer;
begin
  if exists (select 1 from public.rankings where slug = 'unesco-world-heritage-properties-2026-top-5') then
    select id, published_at
    into v_ranking_id, v_published_at
    from public.rankings
    where slug = 'unesco-world-heritage-properties-2026-top-5';

    select count(*) into v_italy_count
    from public.ranking_entries
    where ranking_id = v_ranking_id
      and reason = 'UNESCO 공식 국가 페이지를 CONTENT-3에서 재검증한 결과 2026-08-19 기준 세계유산 62건을 표시하여 단독 1위로 갱신했습니다.';

    select count(*) into v_china_count
    from public.ranking_entries
    where ranking_id = v_ranking_id
      and reason = 'UNESCO 공식 국가 페이지를 CONTENT-3에서 재검증한 결과 2026-08-19 기준 세계유산 61건을 표시하여 2위입니다.';

    if v_italy_count = 1 and v_china_count = 1 then
      update public.rankings
      set status = 'draft', published_at = null
      where id = v_ranking_id;

      update public.ranking_entries
      set reason = 'UNESCO 공식 국가 페이지를 재확인한 결과 2026-08-19 기준 세계유산 62건을 표시하여 단독 1위로 갱신했습니다.'
      where ranking_id = v_ranking_id
        and reason = 'UNESCO 공식 국가 페이지를 CONTENT-3에서 재검증한 결과 2026-08-19 기준 세계유산 62건을 표시하여 단독 1위로 갱신했습니다.';

      update public.ranking_entries
      set reason = 'UNESCO 공식 국가 페이지를 재확인한 결과 2026-08-19 기준 세계유산 61건을 표시하여 2위입니다.'
      where ranking_id = v_ranking_id
        and reason = 'UNESCO 공식 국가 페이지를 CONTENT-3에서 재검증한 결과 2026-08-19 기준 세계유산 61건을 표시하여 2위입니다.';

      update public.rankings
      set status = 'published', published_at = v_published_at
      where id = v_ranking_id;
    elsif exists (
      select 1
      from public.ranking_entries
      where ranking_id = v_ranking_id
        and reason in (
          'UNESCO 공식 국가 페이지를 재확인한 결과 2026-08-19 기준 세계유산 62건을 표시하여 단독 1위로 갱신했습니다.',
          'UNESCO 공식 국가 페이지를 재확인한 결과 2026-08-19 기준 세계유산 61건을 표시하여 2위입니다.'
        )
    ) then
      if (
        select count(*)
        from public.ranking_entries
        where ranking_id = v_ranking_id
          and reason in (
            'UNESCO 공식 국가 페이지를 재확인한 결과 2026-08-19 기준 세계유산 62건을 표시하여 단독 1위로 갱신했습니다.',
            'UNESCO 공식 국가 페이지를 재확인한 결과 2026-08-19 기준 세계유산 61건을 표시하여 2위입니다.'
          )
      ) <> 2 then
        raise exception using errcode = '23514', message = 'public copy hygiene boundary aborted: partial UNESCO entry remediation';
      end if;
    else
      raise exception using errcode = '23514', message = 'public copy hygiene boundary aborted: unexpected UNESCO entry reasons';
    end if;
  end if;
end;
$$;

create or replace function private.ops_1_public_copy_hygiene_blockers(p_ranking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_marker_fields text[];
begin
  select array_agg(distinct field_name order by field_name)
  into v_marker_fields
  from (
    select 'ranking.title'::text as field_name, r.title as value
    from public.rankings r where r.id = p_ranking_id
    union all
    select 'ranking.summary', r.summary
    from public.rankings r where r.id = p_ranking_id
    union all
    select 'ranking.body', r.body
    from public.rankings r where r.id = p_ranking_id
    union all
    select 'ranking.seo_title', r.seo_title
    from public.rankings r where r.id = p_ranking_id
    union all
    select 'ranking.seo_description', r.seo_description
    from public.rankings r where r.id = p_ranking_id
    union all
    select 'ranking.scope_json', r.scope_json::text
    from public.rankings r where r.id = p_ranking_id
    union all
    select 'entry.reason', re.reason
    from public.ranking_entries re where re.ranking_id = p_ranking_id
    union all
    select 'entry.score_json', re.score_json::text
    from public.ranking_entries re where re.ranking_id = p_ranking_id
    union all
    select 'criteria.name', rc.name
    from public.ranking_criteria rc where rc.ranking_id = p_ranking_id
    union all
    select 'criteria.description', rc.description
    from public.ranking_criteria rc where rc.ranking_id = p_ranking_id
    union all
    select 'source.label', rs.label
    from public.ranking_sources rs where rs.ranking_id = p_ranking_id and rs.is_public is true
    union all
    select 'source.note', rs.note
    from public.ranking_sources rs where rs.ranking_id = p_ranking_id and rs.is_public is true
  ) public_copy
  where coalesce(public_copy.value, '') ~* '(^|[^A-Za-z0-9_])(P[0-9]+(-[0-9]+)+|OPS-[0-9]+|CONTENT-[0-9]+|LAUNCH-[0-9]+|MEASURE-[0-9]+|UI-[0-9]+[A-Z]?|IA-[0-9]+)([^A-Za-z0-9_]|$)';

  if coalesce(cardinality(v_marker_fields), 0) = 0 then
    return '[]'::jsonb;
  end if;

  return jsonb_build_array(jsonb_build_object(
    'code', 'internal_public_copy_marker',
    'message', format('공개 문구에 내부 운영 단계 코드가 포함되어 있습니다: %s', array_to_string(v_marker_fields, ', ')),
    'fields', to_jsonb(v_marker_fields)
  ));
end;
$$;

commit;
