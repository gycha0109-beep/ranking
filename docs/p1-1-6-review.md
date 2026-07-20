# P1-1.6 Independent Review

## Findings corrected during review

1. The first implementation attempted to re-export a `use server` action module through a wildcard facade. Next.js rejected it because server-action modules may export only async functions. The facade was replaced with explicit async forwarding functions and verified by a production build.
2. Repeated moderation-term queries were removed from the ranking save path. Terms are loaded once and reused for the ranking and every entry.
3. Database validation was extended to reject duplicate facet identifiers before the primary-key insert.
4. Empty scope values, non-integer positions, duplicate positions/items, missing reasons, and invalid references are validated both before RPC invocation and inside PostgreSQL.
5. The published document is converted to draft in the same transaction that replaces all child records.

## Accepted residual risk

The current editor component does not submit its page-load concurrency token. The compatibility facade reads `updated_at` immediately before the RPC, preventing write races during the request but not fully detecting two stale long-lived browser tabs. This is explicitly documented and should be resolved during the editor-form refactor rather than by expanding the already large client component in this hotfix.
