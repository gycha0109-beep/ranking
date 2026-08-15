# P2-2 Ranking Change History & Vote Finalization — Final Contract

Status: **DESIGN CLOSED / IMPLEMENTATION AUTHORIZED**

## Authoritative contract

1. P2-2 adds an immutable official ranking-order revision ledger.
2. V1 revision types are `vote_finalization` and `vote_void` only; draft saves are not revisions.
3. Revision rows and revision-entry snapshots are raw RPC-only data; anon/auth receive only bounded public history.
4. Public history is available only for a currently published/public-safe ranking and never exposes actor IDs or ballot identities.
5. `vote_finalization` requires `content_manage`, closed voting, a published/public-safe `user_vote` ranking, all candidates public-safe/active, at least two candidates, at least one ballot, and a bounded reason.
6. Final deterministic order remains P2-1: vote count DESC → seed/canonical position ASC → item UUID ASC.
7. Finalization is atomic: aggregate snapshot → revision snapshot → ballot consumption → collision-free canonical position materialization → ranking metadata update.
8. Ballot consumption occurs inside the finalization transaction only after the immutable aggregate snapshot exists; rollback restores the entire prestate.
9. `vote_void` is a reason-required, content-manager-only, closed-round terminal path that records the discard and consumes ballots without changing canonical positions.
10. A finalized/voided round is terminal. A later open starts a fresh ballot set; moderation close/reopen before terminal action remains the same round.
11. `vote_round` is derived from prior terminal revisions; no additional mutable round state table is introduced.
12. Finalization/void use the same exclusive P2-1 voting-state advisory lock.
13. Canonical position permutation uses a positive temporary offset before writing final positions, preserving the existing uniqueness/check constraints throughout the transaction.
14. Revision snapshots identify items by UUID value plus immutable title/slug/reason snapshots, never by volatile `ranking_entry_id`.
15. Once a ranking has revision history, physical deletion is rejected by FK integrity; archive remains available.
16. Public ranking detail gains a compact official change-history section.
17. Existing `user_vote` SEO live-order behavior remains; after finalization, consumed ballots plus materialized positions make the canonical order authoritative automatically.
18. P2-2 adds its own repository verifier and CI gate and must pass Hosted rollback-fixture validation before PR readiness.

## Explicitly deferred

- generalized editor draft/publication version control
- revision rollback
- ballot identity/event history
- weighted or ranked-choice voting
- scheduled voting rounds
- crawler/import work
