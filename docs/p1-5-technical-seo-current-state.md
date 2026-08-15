# P1-5 Technical SEO Current State

Baseline: `main@33c818e05d81045b4c17596a5bf92c729df776f5`.

## Confirmed state

- Root layout has only static title/description metadata.
- Ranking/item detail routes do not define route-specific metadata.
- Category/subcategory browse routes do not define canonical/indexing policy for sort/cursor/facet query variants.
- `/search` has no explicit noindex contract.
- No `app/sitemap.ts` or `app/robots.ts` exists.
- No JSON-LD is emitted for ranking or item detail pages.
- `/admin`, `/me`, and `/login` do not have an explicit route-level noindex policy.
- README still describes the project as P0-Core and lists already-completed P1 search/reaction/comment features as excluded TODOs.
- Existing public queries already enforce ranking/item public status and moderation boundaries; P1-5 does not require persistent DB DDL.

## Hosted authority

Hosted migration head remains `20260815145454 p1_4_facet_discovery`.
Current publicly eligible corpus at investigation time: 1 ranking, 6 items, 1 visible category, 0 visible subcategories.

## Gap

P1 usecases include SEO hardening. P1-2 engagement/moderation, P1-3 search/discovery, and P1-4 facet discovery are implemented, but technical SEO/indexing policy is not closed.
