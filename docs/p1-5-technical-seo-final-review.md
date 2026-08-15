# P1-5 Technical SEO Final Review

## Contract coverage

- Dynamic canonical metadata: ranking, item, category, subcategory.
- Root `metadataBase` and social defaults.
- Search noindex/follow.
- Category Facet/sort/cursor variants noindex/follow through `X-Robots-Tag` with clean canonical metadata.
- Admin/account/login noindex/nofollow and robots exclusion.
- Runtime public-safe sitemap.
- Robots sitemap/host declaration.
- Ranking `ItemList` + breadcrumb JSON-LD.
- Generic item `WebPage`/`Thing` + breadcrumb JSON-LD.
- JSON-LD `<` sanitization.
- Middleware excludes `robots.txt`/`sitemap.xml` from auth processing.
- README lifecycle reconciliation.
- `verify:p1-5` included in CI after P1-2/P1-3/P1-4 gates.

## Review corrections

The initial `/search` robots disallow was removed because it conflicted with observing page-level noindex. Search remains crawlable but non-indexable and is absent from sitemap.

## Hosted

Hosted validation passed without schema/data mutation. Migration head remains P1-4.

## Remaining gate

Exact feature-head CI and PR-triggered CI remain required before merge approval.

Status: `READY_FOR_EXACT_HEAD_CI`.
