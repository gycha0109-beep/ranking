begin;

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
  where coalesce(public_copy.value, '') ~* '(^|[^[:alnum:]_])(P[0-9]+(-[0-9]+)+|OPS-[0-9]+|CONTENT-[0-9]+|LAUNCH-[0-9]+|MEASURE-[0-9]+|UI-[0-9]+[A-Z]?|IA-[0-9]+)([^[:alnum:]_]|$)';

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

-- Production copy remediation is conditional so fresh databases without these rows remain valid.
do $$
declare
  v_ranking_id uuid;
  v_published_at timestamptz;
  v_body text;
  v_note text;
begin
  if exists (select 1 from public.rankings where slug = 'fifa-men-world-ranking-2026-07-top-5') then
    select id, published_at, body
    into v_ranking_id, v_published_at, v_body
    from public.rankings
    where slug = 'fifa-men-world-ranking-2026-07-top-5';

    if v_body = 'FIFA가 2026년 7월 20일 발표한 공식 남자 세계랭킹 스냅샷입니다. 이 문서는 FIFA의 공식 순위 자체를 보존하는 snapshot이며 다음 공식 업데이트 이후 CONTENT-3 재검증 대상입니다.' then
      update public.rankings set status = 'draft', published_at = null where id = v_ranking_id;
      update public.rankings
      set body = 'FIFA가 2026년 7월 20일 발표한 공식 남자 세계랭킹 스냅샷입니다. FIFA의 공식 발표 순서를 그대로 기록했으며, 이후 공식 업데이트가 발표되면 최신 상태를 다시 확인합니다.'
      where id = v_ranking_id;
      update public.rankings set status = 'published', published_at = v_published_at where id = v_ranking_id;
    elsif v_body is distinct from 'FIFA가 2026년 7월 20일 발표한 공식 남자 세계랭킹 스냅샷입니다. FIFA의 공식 발표 순서를 그대로 기록했으며, 이후 공식 업데이트가 발표되면 최신 상태를 다시 확인합니다.' then
      raise exception using errcode = '23514', message = 'public copy hygiene aborted: unexpected FIFA men body';
    end if;
  end if;

  if exists (select 1 from public.rankings where slug = 'fifa-women-world-ranking-2026-06-top-5') then
    select id, published_at, body
    into v_ranking_id, v_published_at, v_body
    from public.rankings
    where slug = 'fifa-women-world-ranking-2026-06-top-5';

    if v_body = 'FIFA가 2026년 6월 16일 발표한 공식 여자 세계랭킹 스냅샷입니다. 스페인 1위, 미국 2위, 독일 3위, 잉글랜드 4위, 일본 5위를 기록했습니다. 다음 공식 업데이트 이후 CONTENT-3 재검증 대상입니다.' then
      update public.rankings set status = 'draft', published_at = null where id = v_ranking_id;
      update public.rankings
      set body = 'FIFA가 2026년 6월 16일 발표한 공식 여자 세계랭킹 스냅샷입니다. 스페인 1위, 미국 2위, 독일 3위, 잉글랜드 4위, 일본 5위를 기록했습니다. 이후 공식 업데이트가 발표되면 최신 상태를 다시 확인합니다.'
      where id = v_ranking_id;
      update public.rankings set status = 'published', published_at = v_published_at where id = v_ranking_id;
    elsif v_body is distinct from 'FIFA가 2026년 6월 16일 발표한 공식 여자 세계랭킹 스냅샷입니다. 스페인 1위, 미국 2위, 독일 3위, 잉글랜드 4위, 일본 5위를 기록했습니다. 이후 공식 업데이트가 발표되면 최신 상태를 다시 확인합니다.' then
      raise exception using errcode = '23514', message = 'public copy hygiene aborted: unexpected FIFA women body';
    end if;
  end if;

  if exists (select 1 from public.rankings where slug = 'unesco-world-heritage-properties-2026-top-5') then
    select r.id, r.published_at, rs.note
    into v_ranking_id, v_published_at, v_note
    from public.rankings r
    join public.ranking_sources rs on rs.ranking_id = r.id
    where r.slug = 'unesco-world-heritage-properties-2026-top-5'
      and rs.label = 'UNESCO — Italy';

    if not found then
      raise exception using errcode = '23514', message = 'public copy hygiene aborted: UNESCO Italy source not found';
    end if;

    if v_note = '2026-08-19 CONTENT-3 재검증: 62 properties.' then
      update public.rankings set status = 'draft', published_at = null where id = v_ranking_id;
      update public.ranking_sources
      set note = '2026-08-19 확인: 62 properties.'
      where ranking_id = v_ranking_id and label = 'UNESCO — Italy';
      update public.rankings set status = 'published', published_at = v_published_at where id = v_ranking_id;
    elsif v_note is distinct from '2026-08-19 확인: 62 properties.' then
      raise exception using errcode = '23514', message = 'public copy hygiene aborted: unexpected UNESCO Italy source note';
    end if;
  end if;
end;
$$;

create or replace function private.ops_1_assert_ranking_editorial_ready(p_ranking_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_readiness jsonb;
  v_hygiene_blockers jsonb;
  v_all_blockers jsonb;
  v_message text;
begin
  v_readiness := private.ops_1_ranking_editorial_readiness(p_ranking_id);
  v_hygiene_blockers := private.ops_1_public_copy_hygiene_blockers(p_ranking_id);
  v_all_blockers := coalesce(v_readiness -> 'blockers', '[]'::jsonb) || coalesce(v_hygiene_blockers, '[]'::jsonb);

  if coalesce((v_readiness ->> 'editorial_ready')::boolean, false)
     and jsonb_array_length(coalesce(v_hygiene_blockers, '[]'::jsonb)) = 0 then
    return;
  end if;

  select string_agg(value ->> 'message', '; ')
  into v_message
  from jsonb_array_elements(v_all_blockers) as blockers(value);

  raise exception using
    errcode = '23514',
    message = 'OPS-1 editorial quality gate: ' || coalesce(v_message, '발행 품질 기준을 충족하지 못했습니다.');
end;
$$;

create or replace function public.admin_get_ranking_editorial_readiness(p_ranking_id uuid default null)
returns table (
  ranking_id uuid,
  ranking_status text,
  editorial_ready boolean,
  blockers jsonb,
  entry_count integer,
  criteria_count integer,
  public_source_count integer,
  expected_entry_count integer
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  return query
  select
    r.id,
    r.status,
    coalesce((q.readiness ->> 'editorial_ready')::boolean, false)
      and jsonb_array_length(q.hygiene_blockers) = 0,
    coalesce(q.readiness -> 'blockers', '[]'::jsonb) || q.hygiene_blockers,
    coalesce((q.readiness ->> 'entry_count')::integer, 0),
    coalesce((q.readiness ->> 'criteria_count')::integer, 0),
    coalesce((q.readiness ->> 'public_source_count')::integer, 0),
    nullif(q.readiness ->> 'expected_entry_count', '')::integer
  from public.rankings r
  cross join lateral (
    select
      private.ops_1_ranking_editorial_readiness(r.id) as readiness,
      private.ops_1_public_copy_hygiene_blockers(r.id) as hygiene_blockers
  ) q
  where p_ranking_id is null or r.id = p_ranking_id
  order by r.created_at desc;
end;
$$;

revoke all on function public.admin_get_ranking_editorial_readiness(uuid) from public;
grant execute on function public.admin_get_ranking_editorial_readiness(uuid) to authenticated;

commit;
