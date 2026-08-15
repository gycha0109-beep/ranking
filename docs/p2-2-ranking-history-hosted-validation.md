# P2-2 Ranking Change History & Vote Finalization — Hosted Validation

Supabase project: `yjdubukqkcvkymabskzd`

## Applied repository migrations

1. `supabase/migrations/20260816020000_p2_2_ranking_history_vote_finalization.sql`
   - Hosted: `20260815164730 p2_2_ranking_history_vote_finalization`
2. `supabase/migrations/20260816021000_p2_2_public_history_moderation_filter.sql`
   - Hosted: `20260815164926 p2_2_public_history_moderation_filter`

Hosted migration head after validation:

`20260815164926 p2_2_public_history_moderation_filter`

## Structural validation

Confirmed on Hosted Postgres:

- `ranking_revisions` and `ranking_revision_entries` exist with RLS enabled.
- Direct SELECT privilege on both raw tables is absent for anon/authenticated.
- `get_public_ranking_history(uuid, integer)` is executable by anon/authenticated.
- `finalize_ranking_vote(uuid, text)` and `void_ranking_vote_round(uuid, text)` are not executable by anon and are executable by authenticated callers, with `content_manage` re-checked inside each function.
- Both migrations compiled successfully through `apply_migration`.
- Immutable history triggers are installed.
- `idx_ranking_revisions_actor` covers the new actor foreign key; no P2-2 unindexed-FK advisor finding remains.

## Moderation remediation discovered during validation

The first history RPC implementation would have continued returning an immutable historical title/slug snapshot after the corresponding item was later blocked or hidden. That could create a public moderation bypass through historical diffs.

The second repository/Hosted migration replaces the public history RPC so finalized diff entries are returned only while the current item remains:

- `status='active'`
- text moderation `clean | suggestive`
- image moderation `clean | suggestive`
- and, when still present in the current ranking, the current ranking entry remains public-safe.

`vote_void` continues to return no candidate-level `changes` at all.

## Rollback semantic fixture

A synthetic published `user_vote` ranking with two candidates was created inside one transaction using an existing `content_manage` operator as the synthetic ballot account. The complete transaction was rolled back.

Validated:

1. finalization is rejected while voting is open;
2. a closed first round with one vote for seed #2 finalizes successfully;
3. revision #1 / vote round #1 is created;
4. canonical order changes from A>B to B>A;
5. both changed positions are captured in immutable revision-entry snapshots;
6. completed ballots are consumed;
7. public history exposes both currently safe candidate diffs;
8. revision UPDATE is rejected;
9. repeat finalization with no remaining ballots is rejected;
10. a fresh second round can be opened after the first finalization;
11. round #2 finalization advances revision/round numbers and materializes A>B again;
12. a third round auto-closes when candidate B becomes blocked through the existing P2-1 moderation reconciliation;
13. finalization of the unsafe third round is rejected;
14. after B becomes blocked, B is also removed from already-finalized public history diffs, proving the moderation remediation;
15. `vote_void` terminates the unusable third round as revision #3 / vote round #3;
16. void consumes the remaining ballot without changing canonical positions;
17. public void history exposes `changes=[]` and therefore no candidate snapshot details;
18. once the terminal void consumes ballots, the authored entry is editable again;
19. physical deletion of a ranking with immutable revision history is rejected;
20. the complete fixture rolls back with no persistent synthetic content, ballots, settings, revisions, or revision-entry rows.

Fixture result inside the transaction:

- semantic result: `PASSED`
- revisions created: 3
- revision-entry snapshots created: 6

## Post-validation real Hosted state

- real `user_vote` rankings: 0
- `ranking_votes`: 0 rows
- `ranking_vote_settings`: 0 rows
- `ranking_revisions`: 0 rows
- `ranking_revision_entries`: 0 rows

No fixture residue remains.

## Advisor review

### Security

New P2-2 findings are intentional interface-boundary findings:

- `ranking_revisions` / `ranking_revision_entries`: RLS enabled with no policies because raw history is deliberately RPC-only and direct anon/auth grants are revoked.
  - Supabase reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- `get_public_ranking_history`: anon-executable SECURITY DEFINER warning is expected for a bounded public read RPC that gates on current ranking visibility and re-checks current moderation state.
  - Supabase reference: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- `finalize_ranking_vote` / `void_ranking_vote_round`: authenticated-executable SECURITY DEFINER warnings are expected because these functions are the transaction boundary and internally require `content_manage`.
  - Supabase reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

Existing unrelated security notices remain outside P2-2 scope.

### Performance

- No P2-2 unindexed foreign-key finding is present.
- `idx_ranking_revisions_actor` currently reports expected `unused_index` INFO because production revision traffic is zero.
  - Supabase reference: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
- Existing unrelated performance findings remain outside P2-2 scope.

## Result

**HOSTED VALIDATION PASSED**
