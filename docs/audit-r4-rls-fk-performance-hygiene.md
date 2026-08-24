# AUDIT-R4 — RLS / Foreign-Key Performance Hygiene

## Purpose

AUDIT-R4 is a performance-hygiene remediation. It does not redesign authorization, publication authority, moderation, engagement, or product behavior.

The target is to reduce avoidable RLS evaluation overhead and add only foreign-key indexes that have a verified recurring query path.

## Hosted advisor inventory

Supabase Performance Advisor reported three relevant families:

1. `auth_rls_initplan` — Auth helper calls evaluated per row in selected RLS policies.
2. `multiple_permissive_policies` — mutation `FOR ALL` policies also participate in `SELECT`, duplicating public/admin read policies.
3. `unindexed_foreign_keys` — many FK constraints have no covering index.

`unused_index` findings are intentionally excluded from remediation. An advisor "unused" observation is not sufficient evidence to delete an index.

References:

- https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
- https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
- https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## Hosted row-volume snapshot before migration

| Table | Rows |
| --- | ---: |
| `product_usage_events` | 210 |
| `ranking_entries` | 82 |
| `items` | 61 |
| `ranking_sources` | 30 |
| `ar_pain_evidences` | 27 |
| `ranking_criteria` | 21 |
| `rankings` | 18 |
| `ar_problem_evidence_links` | 15 |
| `ar_problem_candidates` | 12 |
| `moderation_reviews` | 11 |
| `ar_raw_inputs` | 10 |
| `subcategories` | 9 |
| `categories` | 7 |
| `comment_mutation_events` | 4 |
| `comments` | 2 |
| `notifications` | 2 |
| `user_sanctions` | 1 |
| `facet_groups` | 0 |
| `facets` | 0 |
| `item_facets` | 0 |
| `ranking_facets` | 0 |
| `reactions` | 0 |

The low current row counts are a reason to avoid broad speculative indexing. The migration is intentionally narrower than the advisor inventory.

## RLS initplan scope

The hosted policy definitions were read from `pg_policies` before implementation. The following policies contain direct `auth.uid()` or `auth.role()` calls and are rewritten to equivalent scalar subqueries:

- `profiles` — `Users can update their own profile`
- `user_roles` — `Roles viewable by admin`
- `ar_raw_inputs` — `ar_users_can_read_own_raw_inputs`
- `ar_pain_evidences` — `ar_users_can_read_own_pain_evidences`
- `ar_problem_candidates` — `ar_users_can_read_own_problem_candidates`
- `ar_problem_evidence_links` — `ar_users_can_read_own_problem_evidence_links`
- `rankings` — `Rankings select policy`
- `ranking_entries` — `Ranking entries select policy`
- `moderation_reviews` — `Operators can view moderation reviews`
- `reactions` — handled by the mutation-policy split below

The authorization predicates themselves are unchanged: ownership checks still compare the same user id, anonymous publication checks still require the same publication/moderation state, and moderation review access still uses the same capability guard.

## Duplicate permissive-policy scope

The affected tables combine a mutation-authority `FOR ALL` policy with a separate `SELECT` policy. Because `FOR ALL` also participates in reads, both permissive policies are evaluated for `SELECT`.

For the following admin-managed tables, the existing `FOR ALL ... is_admin()` policy is replaced by explicit `INSERT`, `UPDATE`, and `DELETE` policies using the same `is_admin()` predicate:

- `categories`
- `subcategories`
- `rankings`
- `items`
- `ranking_entries`
- `ranking_criteria`
- `ranking_sources`
- `ranking_facets`
- `facet_groups`
- `facets`
- `item_facets`
- `moderation_terms`

The existing `SELECT` policy remains the read authority.

`reactions` follows the same structural cleanup with its existing self-ownership predicate: public read remains `Reactions viewable by everyone`, while insert/update/delete remain owner-only.

## Foreign-key index scope

Only two FK indexes are added:

- `idx_ranking_criteria_ranking_id`
- `idx_ranking_sources_ranking_id`

This is justified by recurring authoritative paths observed in hosted function definitions:

- `private.ops_1_public_copy_hygiene_blockers` filters both child tables by `ranking_id`.
- `private.ops_1_ranking_editorial_readiness` repeatedly filters both child tables by `ranking_id`.
- `public.admin_record_ranking_revalidation` reads `ranking_sources` by `ranking_id`.
- `public.save_ranking_e2e` deletes and recreates both child collections by `ranking_id`.

Before the migration, each table had only its primary-key index and `EXPLAIN` showed sequential scans for `WHERE ranking_id = ...`. With the current small tables PostgreSQL may rationally continue choosing a sequential scan after indexes are added; index existence, not forced index usage, is the contract at this size.

Other advisor FK findings remain untouched when there is no comparable query-path justification. In particular, AR, event, moderation-reviewer, notification, and other low-volume FK warnings are not automatically converted into indexes.

## Pre-migration anonymous visibility baseline

A hosted transaction using the `anon` role produced these RLS-visible counts:

- categories: 6
- subcategories: 9
- rankings: 16
- items: 55
- ranking_entries: 76
- ranking_criteria: 16
- ranking_sources: 29

These counts are a regression witness. The same values must be observed after the hosted migration unless production data changes independently during the verification window.

## Migration

`supabase/migrations/20260824003000_audit_r4_rls_fk_performance_hygiene.sql`

The migration deliberately contains no `DROP INDEX` statement and creates only the two justified indexes above.

## Closeout verification

After CI and merge, the migration was applied to the hosted Supabase project and the scoped acceptance contract was read back.

Hosted migration history records:

- version `20260824004213`
- name `audit_r4_rls_fk_performance_hygiene`

The post-migration verification established:

1. targeted Auth helper policies use initplan-safe scalar subqueries;
2. targeted mutation authorities no longer rely on overlapping `cmd = ALL` read participation;
3. the anonymous visibility witness remained `6 / 9 / 16 / 55 / 76 / 16 / 29` for categories, subcategories, rankings, items, ranking entries, ranking criteria, and ranking sources respectively;
4. both targeted indexes exist in the hosted database;
5. current Performance Advisor no longer reports `auth_rls_initplan` or `multiple_permissive_policies` for the remediated scope;
6. current Performance Advisor no longer reports the `ranking_criteria.ranking_id` or `ranking_sources.ranking_id` foreign keys as unindexed;
7. unrelated low-volume `unindexed_foreign_keys` and `unused_index` notices remain intentionally visible rather than being optimized away without evidence.

The two newly added ranking child indexes can currently appear under `unused_index`. At the present low row volume this does not invalidate their query-path justification and is not a reason to delete them.

R4 repository/Production authority:

- PR #99
- merged `main` SHA: `b668cae74f5c20755eac2b49f6275b9c77e23e9c`
- required `CI / validate`: passed before merge
- Vercel Production deployment: `dpl_5iUzZenjT2rNstLisYSpL7EGYCTh`
- Production state: `READY`
- current 24-hour runtime error readback: `0`

## Non-goals

- No authorization expansion.
- No publication-boundary changes.
- No product feature work.
- No advisor-score maximization.
- No speculative indexing of every FK.
- No deletion of indexes solely because the advisor reports them unused.

Final R4 state:

`TARGETED_RLS_OVERHEAD = REMEDIATED / VERIFIED`

`TARGETED_DUPLICATE_PERMISSIVE_POLICIES = REMEDIATED / VERIFIED`

`TARGETED_FK_INDEXES = PRESENT / VERIFIED`

`RESIDUAL_ADVISOR_INFO = ACCEPTED_BY_SCOPE`

`AUDIT_R4 = SUCCESS / CLOSED`

`PRODUCT_FEATURE_INVESTMENT = NO_BUILD`

`OBSERVATION = CONTINUE`
