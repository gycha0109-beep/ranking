# P2-1 User Voting — Design

## Goal

Add a bounded account-based voting system for `user_vote` rankings without rewriting curator positions or exposing ballot identities.

## Voting model

- Only `ranking_type='user_vote'` rankings participate.
- Voting lifecycle is manual `open | closed` only.
- Opening requires a published/public-safe ranking with at least 2 public-safe candidates.
- One authenticated account has one current ballot per ranking.
- The ballot selects exactly one current candidate item.
- While voting is open, users may change or cancel their ballot.
- Closed voting is read-only.
- No `finalized` state and no automatic rewrite of `ranking_entries.position` in P2-1.

## Ordering

Public current vote order is deterministic:

1. vote count descending
2. existing seed `ranking_entries.position` ascending
3. `item_id` ascending

Zero-vote candidates remain visible. Percentages use only ballots whose candidate is currently public eligible.

## Privacy and permissions

- `ranking_votes` and `ranking_vote_settings` have no direct anon/auth table access.
- Public aggregate is exposed only through a bounded SECURITY DEFINER RPC.
- Authenticated users can read only their own selected item through a dedicated RPC.
- Vote writes reuse `private.assert_user_capability(..., 'engagement_write')`.
- Voting open/close requires `content_manage`.
- Functions use fixed search paths and explicit grants; PUBLIC execute is revoked.

## Candidate/document integrity

A ballot stores `(ranking_id, item_id, user_id)`, not `ranking_entry_id`, because the current editor recreates entry rows during saves.

Once at least one ballot remains:

- ranking document content is frozen,
- candidate membership/order is frozen,
- ranking deletion is blocked,
- publication state and moderation fields remain mutable,
- entry moderation fields remain mutable.

If all ballots are canceled, the freeze naturally disappears.

No destructive admin vote reset is provided in P2-1.

## Moderation behavior

Public aggregates include only current public-safe candidates. Ranking/candidate moderation can automatically close an open vote when the ranking ceases to be public or fewer than 2 public-safe candidates remain. Votes attached to temporarily ineligible candidates are retained privately but excluded from public totals.

## UI

A dedicated voting panel appears on public `user_vote` ranking detail pages:

- authoritative current user-vote order
- total votes
- per-candidate counts and percentages
- current viewer selection
- login redirect for anonymous vote attempts
- change/cancel while open
- admin open/close control for content managers

The panel explicitly distinguishes user-vote order from the underlying seed positions retained in the ranking document.

## SEO

Ranking JSON-LD `ItemList` uses the current deterministic vote-derived order for `user_vote` rankings so structured data does not claim seed order as the user result.

## Deferred

- finalization into `ranking_entries.position`
- historical revisions / ranking change history
- ballot-event history
- device/IP anti-abuse scoring
- weighted voting, ranked-choice, multi-select
- scheduled open/close
- destructive reset

These belong to later P2 stages.
