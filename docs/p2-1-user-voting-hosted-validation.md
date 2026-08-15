# P2-1 User Voting — Hosted Validation

Supabase project: `yjdubukqkcvkymabskzd`

## Applied repository migrations

1. `supabase/migrations/20260816010000_p2_1_user_voting.sql`
   - Hosted: `20260815160048 p2_1_user_voting`
2. `supabase/migrations/20260816011000_p2_1_vote_fk_indexes.sql`
   - Hosted: `20260815160432 p2_1_vote_fk_indexes`

Hosted migration head after validation:

`20260815160432 p2_1_vote_fk_indexes`

## Structural validation

Confirmed:

- `ranking_vote_settings` and `ranking_votes` exist with RLS enabled
- raw ballot/settings table access is closed to anon/authenticated
- five public RPCs exist
- `get_ranking_vote_summary(uuid)` is executable by anon/authenticated
- mutation and viewer RPCs are authenticated-only
- voting-state mutation is authenticated and internally requires `content_manage`
- all P2-1 freeze/reconciliation triggers exist
- three P2-1 FK reverse indexes exist

## Rollback semantic fixture

A synthetic user-vote ranking, two candidate items, ballots, and a temporary account suspension were created inside one transaction and fully rolled back.

Validated:

- non-`user_vote` open rejected
- published/public-safe `user_vote` opens
- zero-vote ordering uses seed-position tie-break
- exactly one ballot per account/ranking
- vote change replaces the same ballot
- current-user ballot read
- vote count reorders aggregate ranking
- authored ranking mutation blocked after first vote
- candidate position mutation blocked after first vote
- entry moderation remains available
- reducing public candidates below two auto-closes voting
- ineligible candidate disappears from public summary
- ballot on ineligible candidate is excluded from public total
- moderation recovery does not auto-reopen
- explicit admin reopen works
- user cancellation works while open
- closed poll rejects new vote
- account suspension rejects vote through existing `engagement_write` capability
- fixture rollback leaves zero persistent residue

## Post-validation state

- real `user_vote` rankings: 0
- persistent `ranking_votes` rows: 0
- persistent `ranking_vote_settings` rows: 0

No synthetic production content or ballot residue remains.

Hosted validation result: **PASSED**.
