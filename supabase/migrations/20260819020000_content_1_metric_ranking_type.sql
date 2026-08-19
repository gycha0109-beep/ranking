alter table public.rankings
  drop constraint if exists rankings_ranking_type_check;

alter table public.rankings
  add constraint rankings_ranking_type_check
  check (
    ranking_type = any (
      array[
        'editor_pick'::text,
        'popularity'::text,
        'quality'::text,
        'purpose'::text,
        'metric'::text,
        'user_vote'::text,
        'sponsored'::text
      ]
    )
  );
