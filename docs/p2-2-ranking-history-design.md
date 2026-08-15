# P2-2 Ranking Change History & Vote Finalization — Design

## Goal

Add an immutable public-safe ledger for official ranking-order changes and provide a transactional terminal operation for a P2-1 voting round.

P2-2 makes live user-vote results capable of becoming the canonical ranking order without exposing ballot identities or weakening P2-1 concurrency/moderation boundaries.

## Revision model

Two RPC-only tables are introduced:

### `ranking_revisions`

One immutable official event per revision.

Core fields:

- ranking/revision identity and monotonic `revision_number`
- `change_type`: `vote_finalization | vote_void`
- required operator reason
- actor ID for internal accountability
- ranking title/slug snapshot
- vote-round number
- eligible vote count and total ballot count
- voting opened/closed timestamps
- immutable creation timestamp/metadata

A ranking with revision history cannot be physically deleted; it should be archived instead.

### `ranking_revision_entries`

Immutable per-item before/after snapshot for each revision:

- stable item UUID value, intentionally independent of volatile ranking-entry row IDs
- item title/slug snapshot
- ranking reason snapshot
- before/after canonical positions
- vote count snapshot

This shape supports current P2-2 position diffs while remaining usable for future official change types.

## What becomes a revision in P2-2

P2-2 records terminal voting-round events only:

1. `vote_finalization` — vote result becomes canonical order.
2. `vote_void` — an invalid/unusable round is closed without changing canonical order, but the discard is permanently recorded with an operator reason.

Ordinary draft saves are deliberately excluded. They are working state, not official public revisions. Retrofitting every editor save/publication into a generalized content-version system is outside P2-2.

## Vote finalization contract

`finalize_ranking_vote(ranking_id, reason)` requires:

- authenticated operator with `content_manage`
- `ranking_type='user_vote'`
- voting state `closed`
- published/public-safe ranking
- every current candidate/item public-safe and active
- at least two candidates
- at least one ballot
- non-empty bounded reason

The function takes the same exclusive `ranking-voting-state:<ranking_id>` advisory lock used by P2-1 state management.

Within one transaction it:

1. locks the ranking row;
2. computes the deterministic vote result using the P2-1 ordering contract;
3. creates the immutable revision and per-entry before/after snapshots;
4. consumes the current raw ballots;
5. temporarily moves canonical positions to a collision-free positive offset;
6. materializes final positions from the revision snapshot;
7. updates ranking modification metadata;
8. leaves voting `closed` and returns the revision summary.

Ballots are deleted only after their aggregate snapshot has been persisted inside the same transaction. If any later statement fails, PostgreSQL rolls the entire transaction back, including ballot deletion.

Consuming current ballots is intentional: it ends that round, removes the P2-1 first-ballot freeze, and allows a later fresh round to open without a destructive reset endpoint.

## Vote void contract

`void_ranking_vote_round(ranking_id, reason)` exists to avoid a moderation dead-end when a closed round contains a candidate that can no longer safely be finalized.

It requires `content_manage`, a closed `user_vote` round, at least one ballot, and a reason. It creates an immutable `vote_void` revision, snapshots the current canonical entries, consumes the current ballots atomically, and does not change canonical positions.

This is not an untracked reset: the discarded round remains permanently visible as a terminal history event. Public history does not expose hidden candidate details or ballot identities for voided rounds.

## Vote rounds

No new mutable round table is required in V1.

`vote_round` is derived from the number of prior terminal vote revisions for the ranking plus one. A moderation close/reopen before finalization remains the same round because ballots remain. Finalization or void consumes ballots and terminates the round; a later open starts a fresh round naturally.

## Public history

`get_public_ranking_history(ranking_id, limit)` is a bounded SECURITY DEFINER RPC available to anon/auth only when the ranking itself is currently published and public-safe.

It returns newest revisions first with:

- revision number/type
- reason
- vote round and eligible vote total
- created timestamp
- position-diff JSON for finalized rounds

For `vote_void`, public changes are intentionally empty so hidden/blocked candidate snapshots cannot leak through history.

Actor UUIDs and raw ballot identities are never returned publicly.

## UI

### Voting panel

For content managers, when voting is closed and ballots remain:

- require a reason;
- allow `투표 결과 확정` when the current round is finalizable;
- allow `라운드 폐기` as the auditable recovery path.

Finalization/void errors remain server-authoritative.

### Public ranking history

Ranking detail shows a compact `공식 순위 변경 이력` section with recent terminal vote revisions. Finalized revisions show before/after positions, direction, vote count/share; void revisions show the reason without candidate-level details.

## SEO

P2-1 live-vote JSON-LD behavior remains unchanged while a round has ballots. After finalization the current ballots are consumed and canonical positions have already been materialized, so the existing `user_vote` SEO snapshot naturally resolves to the same canonical order with zero current-round votes.

## Non-goals

- ballot identity/event history
- weighted/ranked-choice voting
- scheduled rounds
- automatic editor draft revisioning
- arbitrary revision rollback
- destructive unlogged vote reset
- crawler/import integration
