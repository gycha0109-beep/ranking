# P1-5 Technical SEO Final Contract

Status: `FINAL_CONTRACT`.

- Clean public category/subcategory URLs may be indexed.
- Any category/subcategory URL with sort/cursor/facet query state is `noindex,follow` and canonicalizes to the clean path.
- `/search` is always `noindex,follow`.
- Admin/account/login surfaces are `noindex,nofollow` and excluded from robots crawl.
- Sitemap contains only root/categories plus publicly eligible category/subcategory/ranking/item canonical URLs.
- Ranking JSON-LD is `ItemList` + `BreadcrumbList` only from public-safe ranking data.
- Item JSON-LD is generic `WebPage`/`Thing` + `BreadcrumbList`; no universal Product schema.
- JSON-LD serialization scrubs `<` to `\u003c`.
- `NEXT_PUBLIC_SITE_URL` > `VERCEL_PROJECT_PRODUCTION_URL` > local CI fallback determines site origin.
- No P1-5 migration or persistent Hosted DDL.
- README and CI are reconciled as part of P1 closure.
- Merge remains separately approval-gated after exact-head and PR CI.
