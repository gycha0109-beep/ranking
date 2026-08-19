begin;

create or replace function private.ops_1_is_usable_source_url(p_url text)
returns boolean
language sql
immutable
set search_path = public, private, pg_temp
as $$
  select coalesce(
    p_url ~* '^https?://[^[:space:]]+$'
    and p_url !~* '^https?://(www\.)?google\.[^/]+/search([/?]|$)'
    and p_url !~* '^https?://(www\.)?bing\.com/search([/?]|$)'
    and p_url !~* '^https?://search\.naver\.com/search([/?]|$)'
    and p_url !~* '^https?://search\.daum\.net/search([/?]|$)'
    and p_url !~* '^https?://(www\.)?youtube\.com/results([/?]|$)',
    false
  );
$$;

create or replace function private.ops_1_ranking_editorial_readiness(p_ranking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_ranking public.rankings%rowtype;
  v_blockers jsonb := '[]'::jsonb;
  v_entry_count integer := 0;
  v_distinct_item_count integer := 0;
  v_distinct_position_count integer := 0;
  v_min_position integer := 0;
  v_max_position integer := 0;
  v_missing_reason_count integer := 0;
  v_inactive_item_count integer := 0;
  v_criteria_count integer := 0;
  v_incomplete_criteria_count integer := 0;
  v_public_source_count integer := 0;
  v_valid_public_source_count integer := 0;
  v_invalid_public_source_count integer := 0;
  v_top_match text[];
  v_expected_entry_count integer := null;
begin
  select *
  into v_ranking
  from public.rankings
  where id = p_ranking_id;

  if not found then
    return jsonb_build_object(
      'ranking_id', p_ranking_id,
      'editorial_ready', false,
      'blockers', jsonb_build_array(jsonb_build_object(
        'code', 'ranking_not_found',
        'message', '랭킹 문서를 찾을 수 없습니다.'
      )),
      'entry_count', 0,
      'criteria_count', 0,
      'public_source_count', 0,
      'expected_entry_count', null
    );
  end if;

  select
    count(*)::integer,
    count(distinct re.item_id)::integer,
    count(distinct re.position)::integer,
    coalesce(min(re.position), 0)::integer,
    coalesce(max(re.position), 0)::integer,
    count(*) filter (where nullif(btrim(coalesce(re.reason, '')), '') is null)::integer,
    count(*) filter (where i.id is null or i.status is distinct from 'active')::integer
  into
    v_entry_count,
    v_distinct_item_count,
    v_distinct_position_count,
    v_min_position,
    v_max_position,
    v_missing_reason_count,
    v_inactive_item_count
  from public.ranking_entries re
  left join public.items i on i.id = re.item_id
  where re.ranking_id = p_ranking_id;

  select
    count(*)::integer,
    count(*) filter (
      where nullif(btrim(coalesce(rc.name, '')), '') is null
         or nullif(btrim(coalesce(rc.description, '')), '') is null
    )::integer
  into v_criteria_count, v_incomplete_criteria_count
  from public.ranking_criteria rc
  where rc.ranking_id = p_ranking_id;

  select
    count(*) filter (where rs.is_public is true)::integer,
    count(*) filter (
      where rs.is_public is true
        and nullif(btrim(coalesce(rs.label, '')), '') is not null
        and private.ops_1_is_usable_source_url(rs.url)
    )::integer,
    count(*) filter (
      where rs.is_public is true
        and (
          nullif(btrim(coalesce(rs.label, '')), '') is null
          or not private.ops_1_is_usable_source_url(rs.url)
        )
    )::integer
  into v_public_source_count, v_valid_public_source_count, v_invalid_public_source_count
  from public.ranking_sources rs
  where rs.ranking_id = p_ranking_id;

  if nullif(btrim(coalesce(v_ranking.title, '')), '') is null then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'missing_title', 'message', '제목이 필요합니다.'));
  end if;

  if v_ranking.category_id is null then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'missing_category', 'message', '카테고리 매핑이 필요합니다.'));
  end if;

  if nullif(btrim(coalesce(v_ranking.summary, '')), '') is null then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'missing_summary', 'message', '공개 요약 설명이 필요합니다.'));
  end if;

  if nullif(btrim(coalesce(v_ranking.scope_json ->> 'target', '')), '') is null
     or nullif(btrim(coalesce(v_ranking.scope_json ->> 'period', '')), '') is null
     or nullif(btrim(coalesce(v_ranking.scope_json ->> 'method', '')), '') is null then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'incomplete_scope',
      'message', '조사 범위의 target, period, method를 모두 작성해야 합니다.'
    ));
  end if;

  if v_entry_count < 2 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'insufficient_entries',
      'message', '공개 랭킹은 최소 2개 이상의 순위 항목이 필요합니다.'
    ));
  end if;

  if v_entry_count > 0 and (
    v_distinct_position_count <> v_entry_count
    or v_min_position <> 1
    or v_max_position <> v_entry_count
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'non_contiguous_positions',
      'message', '순위는 중복 없이 1부터 항목 수까지 연속되어야 합니다.'
    ));
  end if;

  if v_distinct_item_count <> v_entry_count then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'duplicate_items',
      'message', '동일한 아이템을 한 랭킹에 중복 배치할 수 없습니다.'
    ));
  end if;

  if v_missing_reason_count > 0 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'missing_entry_reason',
      'message', '모든 순위 항목에 공개 선정 사유가 필요합니다.'
    ));
  end if;

  if v_inactive_item_count > 0 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'inactive_entry_item',
      'message', '공개 랭킹에는 active 상태의 아이템만 포함할 수 있습니다.'
    ));
  end if;

  if v_criteria_count < 1 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'missing_criteria',
      'message', '최소 1개의 평가 기준이 필요합니다.'
    ));
  elsif v_incomplete_criteria_count > 0 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'incomplete_criteria',
      'message', '모든 평가 기준에 이름과 설명이 필요합니다.'
    ));
  end if;

  if v_ranking.ranking_type <> 'user_vote' then
    if v_valid_public_source_count < 1 then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'missing_usable_public_source',
        'message', '검증 가능한 공개 출처 URL이 최소 1개 필요합니다.'
      ));
    end if;

    if v_invalid_public_source_count > 0 then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'invalid_public_source',
        'message', '공개 출처는 검색결과 페이지가 아닌 직접 검증 가능한 http(s) 자료여야 합니다.'
      ));
    end if;
  end if;

  v_top_match := regexp_match(coalesce(v_ranking.title, ''), '(?i)(TOP|탑)[[:space:]]*([0-9]{1,3})');
  if v_top_match is not null then
    v_expected_entry_count := v_top_match[2]::integer;
    if v_expected_entry_count <> v_entry_count then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'title_entry_count_mismatch',
        'message', format('제목은 TOP %s를 약속하지만 실제 순위 항목은 %s개입니다.', v_expected_entry_count, v_entry_count)
      ));
    end if;
  end if;

  return jsonb_build_object(
    'ranking_id', p_ranking_id,
    'editorial_ready', jsonb_array_length(v_blockers) = 0,
    'blockers', v_blockers,
    'entry_count', v_entry_count,
    'criteria_count', v_criteria_count,
    'public_source_count', v_valid_public_source_count,
    'public_source_rows', v_public_source_count,
    'expected_entry_count', v_expected_entry_count
  );
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
  v_message text;
begin
  v_readiness := private.ops_1_ranking_editorial_readiness(p_ranking_id);

  if coalesce((v_readiness ->> 'editorial_ready')::boolean, false) then
    return;
  end if;

  select string_agg(value ->> 'message', '; ')
  into v_message
  from jsonb_array_elements(coalesce(v_readiness -> 'blockers', '[]'::jsonb)) as blockers(value);

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
    coalesce((q.readiness ->> 'editorial_ready')::boolean, false),
    coalesce(q.readiness -> 'blockers', '[]'::jsonb),
    coalesce((q.readiness ->> 'entry_count')::integer, 0),
    coalesce((q.readiness ->> 'criteria_count')::integer, 0),
    coalesce((q.readiness ->> 'public_source_count')::integer, 0),
    nullif(q.readiness ->> 'expected_entry_count', '')::integer
  from public.rankings r
  cross join lateral (
    select private.ops_1_ranking_editorial_readiness(r.id) as readiness
  ) q
  where p_ranking_id is null or r.id = p_ranking_id
  order by r.created_at desc;
end;
$$;

revoke all on function public.admin_get_ranking_editorial_readiness(uuid) from public;
grant execute on function public.admin_get_ranking_editorial_readiness(uuid) to authenticated;

-- Reconcile known pre-launch content before the new invariant becomes live.
do $$
declare
  v_count integer;
begin
  select count(*)::integer
  into v_count
  from public.rankings r
  where r.slug = 'best-chicken-breast'
    and r.title = '2026 닭가슴살 TOP 10'
    and r.status = 'published'
    and (select count(*) from public.ranking_entries re where re.ranking_id = r.id) = 2
    and (select count(*) from public.ranking_criteria rc where rc.ranking_id = r.id) = 2
    and (select count(*) from public.ranking_sources rs where rs.ranking_id = r.id) = 1;

  if v_count <> 1 then
    raise exception using errcode = '23514', message = 'OPS-1 reconciliation aborted: expected published best-chicken-breast prestate not found exactly once';
  end if;

  update public.rankings
  set status = 'draft', published_at = null, featured = false
  where slug = 'best-chicken-breast';

  select count(*)::integer
  into v_count
  from public.rankings r
  where r.slug = '간편-작성-테스트'
    and r.title = '간편 작성 테스트'
    and r.status = 'draft'
    and (select count(*) from public.ranking_entries re where re.ranking_id = r.id) = 4;

  if v_count <> 1 then
    raise exception using errcode = '23514', message = 'OPS-1 reconciliation aborted: expected quick-create test draft prestate not found exactly once';
  end if;

  select count(*)::integer
  into v_count
  from public.ranking_entries re
  join public.rankings r on r.id = re.ranking_id
  join public.items i on i.id = re.item_id
  where r.slug = '간편-작성-테스트'
    and i.status = 'active'
    and i.title in ('테스트', '중입니다', '어떻게', '나올까요?');

  if v_count <> 4 then
    raise exception using errcode = '23514', message = 'OPS-1 reconciliation aborted: expected four active quick-create test items';
  end if;

  if exists (
    select 1
    from public.ranking_entries test_entry
    join public.rankings test_ranking on test_ranking.id = test_entry.ranking_id
    join public.ranking_entries other_entry on other_entry.item_id = test_entry.item_id
    where test_ranking.slug = '간편-작성-테스트'
      and other_entry.ranking_id <> test_ranking.id
  ) then
    raise exception using errcode = '23514', message = 'OPS-1 reconciliation aborted: a quick-create test item is referenced by another ranking';
  end if;

  update public.rankings
  set status = 'archived', published_at = null, featured = false
  where slug = '간편-작성-테스트';

  update public.items i
  set status = 'archived'
  where i.id in (
    select re.item_id
    from public.ranking_entries re
    join public.rankings r on r.id = re.ranking_id
    where r.slug = '간편-작성-테스트'
  )
  and i.title in ('테스트', '중입니다', '어떻게', '나올까요?');
end;
$$;

create or replace function private.ops_1_enforce_ranking_publish_quality()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.status = 'published' then
    perform private.ops_1_assert_ranking_editorial_ready(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ops_1_ranking_publish_quality on public.rankings;
create constraint trigger trg_ops_1_ranking_publish_quality
after insert or update on public.rankings
deferrable initially immediate
for each row
execute function private.ops_1_enforce_ranking_publish_quality();

create or replace function private.ops_1_block_published_editorial_edit()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if old.status = 'published' and new.status = 'published' then
    raise exception using
      errcode = '23514',
      message = 'OPS-1 published ranking edit blocked: unpublish the ranking before changing editorial fields';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ops_1_block_published_editorial_edit on public.rankings;
create trigger trg_ops_1_block_published_editorial_edit
before update of category_id, subcategory_id, title, slug, summary, body, ranking_type, scope_json, cover_image_url, seo_title, seo_description
on public.rankings
for each row
execute function private.ops_1_block_published_editorial_edit();

create or replace function private.ops_1_recheck_published_parent_quality()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_ranking_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_ranking_id := old.ranking_id;
  else
    v_ranking_id := new.ranking_id;
  end if;

  select status into v_status
  from public.rankings
  where id = v_ranking_id;

  if v_status = 'published' then
    perform private.ops_1_assert_ranking_editorial_ready(v_ranking_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_ops_1_entries_quality on public.ranking_entries;
create constraint trigger trg_ops_1_entries_quality
after insert or update or delete on public.ranking_entries
deferrable initially deferred
for each row
execute function private.ops_1_recheck_published_parent_quality();

drop trigger if exists trg_ops_1_criteria_quality on public.ranking_criteria;
create constraint trigger trg_ops_1_criteria_quality
after insert or update or delete on public.ranking_criteria
deferrable initially deferred
for each row
execute function private.ops_1_recheck_published_parent_quality();

drop trigger if exists trg_ops_1_sources_quality on public.ranking_sources;
create constraint trigger trg_ops_1_sources_quality
after insert or update or delete on public.ranking_sources
deferrable initially deferred
for each row
execute function private.ops_1_recheck_published_parent_quality();

commit;
