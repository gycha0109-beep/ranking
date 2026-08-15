# P2-2 Ranking Change History & Vote Finalization — Current State

Baseline `main`: `00ce3f6e13b8928fd4a80e4b1d0e896388130c57`.

## Repository state

- P2-1 User Voting is merged and closed.
- `ranking_entries.position` is still the authored/canonical position field.
- Live `user_vote` order is derived independently from `get_ranking_vote_summary` as vote count DESC, seed position ASC, item UUID ASC.
- P2-1 deliberately does not materialize live vote order into `ranking_entries.position`.
- Raw ballots are stored in `ranking_votes` and voting state in `ranking_vote_settings`; both are RPC-only for anon/auth.
- `save_ranking_e2e` recreates ranking entries, so entry row IDs are not stable history identifiers.
- Once any ballot remains, P2-1 triggers freeze ranking document/candidate mutation while allowing moderation/publication state changes.
- Vote mutations and voting state changes share the `ranking-voting-state:<ranking_id>` advisory lock namespace.
- Public ranking JSON-LD uses live vote-derived order for `user_vote` rankings.

## Hosted state

Hosted migration head before P2-2: `20260815160432 p2_1_vote_fk_indexes`.

Read-only inspection found:

- `user_vote` rankings: 0
- `ranking_votes`: 0 rows
- `ranking_vote_settings`: 0 rows
- revision/history/snapshot-like public tables: 0

No P2-2 schema is present in Hosted Supabase.

## Constraints carried into P2-2

1. Finalization cannot use the ordinary ranking editor save path while ballots exist because P2-1 freeze triggers intentionally reject candidate/position mutation.
2. Finalization must coordinate with P2-1 writers using the same exclusive voting-state advisory lock.
3. Canonical position updates must respect `UNIQUE(ranking_id, position)` throughout the transaction.
4. Historical identity must use stable `item_id` plus immutable item/title/slug snapshots, not volatile `ranking_entry_id`.
5. Public history must never expose ballot identities.
6. Draft saves are not authoritative public revisions; recording every draft save would create noisy and misleading public history.
