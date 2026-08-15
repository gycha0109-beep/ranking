# P2-1 User Voting — Final Contract Reconciliation

Authority baseline: `cba0f5bea765b850a83ad97f8441ce42233f5f55`

## Final V1 contract

1. `user_vote` only.
2. Manual `open | closed`; no finalized state.
3. At least 2 public-safe candidates to open.
4. One authenticated account, one selected item per ranking.
5. Change/cancel allowed only while open.
6. Account suspension blocks vote mutation through existing `engagement_write` sanction capability.
7. Raw ballot/settings tables are closed to anon/auth direct access.
8. Public output is aggregate-only: candidate count, total, percentage, deterministic current rank, state.
9. Tie-break: votes DESC → seed position ASC → item UUID ASC.
10. Ineligible candidates and their ballots are excluded from public aggregates.
11. Safety/visibility degradation can automatically close voting.
12. First remaining ballot freezes authored ranking content, candidate membership/order, and ranking deletion; moderation and publish/unpublish remain available.
13. No destructive reset in P2-1.
14. Vote order never rewrites `ranking_entries.position`.
15. Public voting panel is the authoritative user-vote result surface; seed order remains explicitly labeled as underlying authored order.
16. `user_vote` JSON-LD uses vote-derived deterministic order.
17. P2-2 owns finalization, revisions, and ranking change history.

## Required implementation surfaces

- `20260816010000_p2_1_user_voting.sql` — voting storage/RPCs/triggers
- `20260816011000_p2_1_vote_fk_indexes.sql` — P2-1 FK reverse-index remediation
- server vote actions
- public voting panel
- ranking layout integration
- SEO ordering integration
- `verify:p2-1`
- CI gate
- Hosted migration and rollback-fixture validation
- exact-head CI and PR lifecycle

## Final review disposition

Implementation review and Hosted validation found no remaining P2-1 blocker. Security advisor findings are intentional RPC-boundary findings; P2-1-specific performance FK findings were remediated and rechecked.
