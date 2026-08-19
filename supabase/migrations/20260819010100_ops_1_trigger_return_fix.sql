begin;

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

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

commit;
