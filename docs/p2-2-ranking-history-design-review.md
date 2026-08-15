# P2-2 Ranking Change History & Vote Finalization — Design Review

## Result

**PASSED AFTER RECONCILIATION**

## Findings

### 1. P2-1 freeze prevents direct canonical materialization

A finalization RPC cannot simply update `ranking_entries.position` while ballots remain. The existing P2-1 trigger correctly rejects that mutation.

**Resolution:** snapshot the aggregate first, then delete the current ballots inside the same transaction, then materialize positions. The existing trigger sees no remaining ballots, while a rollback restores ballots and all preceding writes if materialization fails.

### 2. Candidate moderation can make a round impossible to finalize safely

P2-1 allows moderation changes after voting begins. A permanently blocked candidate can therefore leave a closed round whose public aggregate no longer represents the full authored candidate set.

**Resolution:** finalization requires every current candidate to be public-safe/active. Add an auditable `vote_void` terminal operation to consume an unusable round without pretending it produced an official ranking.

### 3. Reusing draft-save history would overstate working edits as official history

`save_ranking_e2e` is a draft editing operation and recreates child rows. Capturing every save as a public revision would create noise and unstable semantics.

**Resolution:** P2-2 history is an official canonical-order ledger. V1 records vote finalization/void terminal events only.

### 4. Position updates can violate the existing unique constraint mid-update

A direct permutation such as 1→2 and 2→1 can collide with `UNIQUE(ranking_id, position)`.

**Resolution:** shift all affected positions into a positive collision-free offset range, then write the final dense order from the immutable revision snapshot.

### 5. Repeat voting rounds need a clean boundary

Keeping finalized ballots in `ranking_votes` would make the next open state inherit the previous round and retain the first-ballot edit freeze.

**Resolution:** finalization/void consume the current ballots only after immutable snapshot creation. A later open therefore starts a fresh ballot set. `vote_round` is derived from prior terminal revisions rather than adding another mutable round state machine.

### 6. History must survive mutable item labels and ranking-entry row recreation

`ranking_entry_id` is not stable and item title/slug may change later.

**Resolution:** revision entries store item UUID values plus title/slug/reason snapshots and have no FK from snapshot item UUID to mutable `items` rows.

### 7. Public history must not leak private ballot or moderation data

Raw revisions may contain internal actor identity and voided-round candidate snapshots.

**Resolution:** raw history tables remain RPC-only. Public RPC omits actor IDs and returns no candidate diff array for `vote_void` events.

### 8. Immutable history conflicts with physical ranking deletion

If history were cascaded away, it would not be immutable in any meaningful operational sense.

**Resolution:** revision→ranking FK prevents physical deletion once a revision exists. Archived status remains the supported lifecycle path.

## Residual scope

P2-2 does not attempt full content-version control for ordinary editor draft/publish cycles. That remains a separate future extension if product requirements demand Wikipedia-style document revisioning beyond official ranking-order events.
