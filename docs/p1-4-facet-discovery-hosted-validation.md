# P1-4 Facet Discovery Hosted Validation

Hosted Supabase project: `yjdubukqkcvkymabskzd`

## 1. Migration lifecycle

Before apply, Hosted migration history ended at:

- `20260815005658 p1_3_search_discovery`

P1-4 was absent.

Applied exactly one repository migration through `apply_migration`:

- repository migration: `supabase/migrations/20260815020000_p1_4_facet_discovery.sql`
- Hosted migration: `20260815145454 p1_4_facet_discovery`

No earlier migration was rerun.

## 2. Function structure / ACL validation

Public API functions:

- `public.list_public_facet_options(text,text,text,integer)`
- `public.search_public_content(..., uuid[])`
- `public.list_public_rankings(..., uuid[])`

Validated for all three:

- `SECURITY DEFINER = true`
- `STABLE`
- `search_path = pg_catalog, pg_temp`
- anon execute = true
- authenticated execute = true
- PUBLIC execute = false

Private execution bases/helpers:

- `private.p1_3_search_public_content_base`
- `private.p1_3_list_public_rankings_base`
- `private.p1_4_validate_facet_ids`
- `private.p1_4_content_matches_facets`

Validated:

- fixed search path
- anon execute = false
- authenticated execute = false
- PUBLIC execute = false

The two retained P1-3 bases remain the exact P1-3 implementations moved out of the exposed schema.

## 3. Backward compatibility

An anon-role call using the pre-P1-4 argument omission contract succeeded:

```sql
public.search_public_content('테스트','all','relevance',20)
```

The new final Facet array parameter therefore remains backward compatible through its empty-array default.

A rollback fixture also compared no-filter public wrapper IDs with the private P1-3 base ordering and returned equality = true.

## 4. Raw engagement privileges

Direct SELECT privileges remain closed:

- anon `content_likes` = false
- authenticated `content_likes` = false
- anon `content_view_totals` = false
- authenticated `content_view_totals` = false

P1-4 did not broaden engagement-table access.

## 5. Main Facet behavior fixture

Hosted had zero real Facet rows at design time, so all behavior tests used synthetic rows inside one transaction followed by `ROLLBACK`.

Validated outcomes:

- same-group `red OR blue`: 6 eligible mixed results
- cross-group `red AND daily`: 2 eligible mixed results
- ranking-only Facet under `type=ranking`: 1
- item-only Facet under `type=item`: 1
- ranking-only Facet under `type=all`: rejected with SQLSTATE `22023`
- item-only Facet under `type=all`: rejected with SQLSTATE `22023`
- blocked-content exact search result: 0
- Facet linked only to blocked content exposed in `all` options: false
- ranking-only Facet exposed in `all` options: false
- item-only Facet exposed in `all` options: false
- ranking-only Facet exposed in ranking options: true
- item-only Facet exposed in item options: true
- category `red AND daily`: 1
- subcategory `red AND daily`: 1

## 6. Sort preservation

Synthetic ranking publication/view values proved the existing ordering remains unchanged after Facet constraints.

Latest expected/observed order:

1. fixture ranking 3
2. fixture ranking 1
3. fixture ranking 2

Popular expected/observed order:

1. fixture ranking 2 — 20 views
2. fixture ranking 3 — 10 views
3. fixture ranking 1 — 5 views

No Facet score/weight was introduced.

## 7. Filtered keyset pagination

### Ranking browse

Popular filtered pages:

- page 1: ranking 2, ranking 3
- page 2: ranking 1
- overlap: 0

### Search RPC under anon role

Popular filtered search pages:

- page 1: fixture row 1, fixture row 2
- page 2: fixture row 3
- overlap: 0

Anon public Facet-option lookup in the fixture category also succeeded.

## 8. Internal batch-boundary validation

A separate rollback fixture inserted 60 public rankings matching one search query and attached the selected Facet only to the 60th/base-late row.

Result:

- filtered result count = 1
- expected 60th row found = true

This proves the wrapper continues across its internal 50-row P1-3 base batch boundary rather than stopping after one unmatched batch.

## 9. Maximum selection validation

Direct helper validation with 13 unique Facet UUIDs produced the expected SQLSTATE `22023` / maximum-12 rejection.

## 10. Index/planner evidence

No P1-4 index was added.

With sequential scans disabled inside rollback-only EXPLAIN sessions, Postgres selected:

- `Index Only Scan using idx_ranking_facets_p1_3_reverse`
- `Index Only Scan using idx_item_facets_p1_3_reverse`

The existing P1-3 reverse indexes therefore support the new selected-Facet lookup path. Existing relation primary keys support the opposite content-to-Facet direction.

No `ANALYZE` was run on synthetic fixtures, so validation did not alter planner statistics.

## 11. Fixture residue

Final residue checks for P1-4 fixture prefixes returned zero for:

- categories
- subcategories
- facet groups
- facets
- rankings
- items

No synthetic fixture data persisted.

## 12. Advisor review

### Security advisor

P1-4 public read RPCs appear in the generic SECURITY DEFINER executable warnings because they are intentionally callable by anon/authenticated users.

They were explicitly reviewed and retain:

- fixed search path
- bounded/validated inputs
- explicit status + moderation predicates
- PUBLIC execute revoked
- safe fixed outputs
- private bases/helpers not externally executable

Other RLS-no-policy and SECURITY DEFINER warnings are existing architecture/debt outside P1-4.

Relevant Supabase remediation references:

- RLS no policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- anon SECURITY DEFINER: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- authenticated SECURITY DEFINER: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

### Performance advisor

Existing notices include unindexed foreign keys, RLS init-plan opportunities, multiple permissive policies, and unused indexes. P1-4 added no index.

P1-3 indexes may still appear unused because the real Hosted corpus is tiny and has essentially no production traffic. This is not a deletion signal; direct EXPLAIN demonstrated the reverse Facet indexes are usable for P1-4.

Relevant Supabase remediation references:

- unindexed foreign keys: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
- auth RLS init plan: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
- unused indexes: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
- multiple permissive policies: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## 13. Hosted gate result

**PASS**

P1-4 is ready for final repository review and exact-head CI.