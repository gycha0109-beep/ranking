# P2-1 User Voting — Hosted Validation Review

## Result

**PASSED / NO P2-1 BLOCKER**

## Security advisor classification

P2-1-specific findings are intentional consequences of an RPC-only security boundary:

- `ranking_vote_settings` / `ranking_votes`: RLS enabled with no direct policies. Direct anon/authenticated table privileges are revoked, so access is intentionally RPC-only.
- `get_ranking_vote_summary`: anon SECURITY DEFINER execution is intentional for the public aggregate contract.
- authenticated execution of `get_my_ranking_vote`, `get_ranking_vote_summary`, `set_ranking_vote`, `clear_ranking_vote`, and `set_ranking_voting_state` is intentional. Fixed search paths and internal identity/capability checks are present.

Raw ballots are not exposed publicly.

Other advisor findings belong to pre-existing tables/functions and are outside P2-1 scope.

## Performance advisor classification

Initial P2-1-specific unindexed-FK INFO was remediated with `20260816011000_p2_1_vote_fk_indexes.sql`.

After remediation:

- no P2-1 `unindexed_foreign_keys` findings remain
- the three new reverse indexes appear only as `unused_index` INFO because production currently has no real `user_vote` ranking/traffic
- those indexes are retained because they cover FK maintenance/delete paths and must not be removed based on zero traffic

Remaining RLS initplan, multiple-permissive-policy, unrelated unindexed-FK, and historical unused-index findings predate P2-1.

## Residue / authority

Hosted P2-1 migration head is `20260815160432 p2_1_vote_fk_indexes` and rollback-fixture residue is zero.

The Hosted state matches the repository P2-1 migration sequence.
