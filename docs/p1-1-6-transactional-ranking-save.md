# P1-1.6 Transactional Ranking Save

## Baseline problem

The previous `saveRankingE2E` action updated a ranking and then deleted/reinserted criteria, sources, entries, and facets through separate HTTP requests. A failure could leave a published ranking partially updated or temporarily empty.

## Implemented controls

- `save_ranking_e2e` performs the entire write in one PostgreSQL transaction.
- The target ranking row is locked with `FOR UPDATE`.
- `updated_at` is checked immediately before the transactional write to reject races occurring during a save request.
- Every edit converts a published ranking to `draft` and clears `published_at` atomically.
- Category/subcategory, scope, criteria, integer positions, unique items, item references, facet references, and duplicate facets are revalidated inside PostgreSQL.
- The Server Action keeps early validation for UX while the database remains authoritative.
- Moderation terms are loaded once per save instead of once per entry.
- Moderation configuration failures close as `needs_review/system_error`.
- Zero-valued scores and weights are preserved using nullish handling.

## Publishing workflow

`Published -> Edit/Save -> Draft -> Preview -> Publish`

A published document is never modified in place while still exposed publicly.

## Verification

- `npm run lint`
- `npm run build`
- Live Supabase transaction smoke: a published ranking became draft with all entries intact inside a test transaction, then returned to its original published state after rollback.

## Residual limitation

The existing editor UI does not yet submit the page-load `updated_at` value. The current facade reads it immediately before invoking the RPC, so database races during the save request are rejected, but two long-lived stale browser tabs are not fully distinguished. Full editor-session optimistic locking should be added when the editor form is next refactored.

Immutable published revisions and revision history remain a later revision-model phase.
