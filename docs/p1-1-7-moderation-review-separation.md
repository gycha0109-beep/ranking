# P1-1.7 Moderation Review Separation

## Implemented

- Replaced cascading ranking approval with entity-specific review RPCs.
- Added append-only `moderation_reviews` history.
- Separated text and image review metadata.
- Image URL insert/change resets image status to `needs_review`; image removal resets it to `clean`.
- Added per-entity admin review UI and shared-item impact warning.
- Preserved the existing publish gate across ranking text/image, entries, items, and item images.
- Removed the legacy `approve_ranking_moderation` RPC.

## Independent review corrections

- Review functions lock the exact target row before changing state.
- Ranking review never mutates entries or items.
- Entry review never mutates its shared item.
- Blocked-to-public transitions require a review note of at least ten characters.
- Same-state reviews require a note.
- `moderation_reviews` rejects UPDATE and DELETE.
- Image URL triggers reset only image review metadata and do not erase text review metadata.
- Public wrappers expose fixed RPC names instead of accepting arbitrary table names.

## Live Supabase verification

- Entry decision changed only the selected entry; ranking and item remained unchanged.
- Exactly one append-only review record was produced inside the test transaction.
- Ranking image URL change produced `needs_review / none` and reset image review metadata.
- Append-only UPDATE guard raised SQLSTATE `55000`.
- All smoke changes were executed in transactions and rolled back.

## Verification commands

- `npm run lint`
- `npm run build`
- GitHub Actions CI
