# P1-5 Technical SEO Design Review

## Findings

1. **Facet crawl explosion risk**: category/subcategory query variants must not become indexable landing pages in P1-5. Resolve with `noindex,follow` and clean canonical.
2. **Search indexing risk**: `/search` can generate high-cardinality URLs and contains user-supplied query state. Keep all search URLs noindex.
3. **Structured-data overclaim risk**: items span heterogeneous domains. Generic `Product` is invalid as a universal type. Use `WebPage` with `Thing` unless a future item-type contract supports a narrower schema.
4. **Origin reliability**: absolute metadata/sitemap URLs need a stable production origin, but CI must build without production secrets. Use explicit env precedence with safe local fallback.
5. **Public-boundary reuse**: sitemap and metadata must reuse the exact public status/moderation predicates already used by public queries; no service-role bypass.
6. **SEO closure is code-only**: no schema change is justified.

## Result

`APPROVED_WITH_RECONCILIATION`.
