# P1-5 Technical SEO Design

## Goal

Close the remaining P1 SEO gap without changing ranking semantics, engagement semantics, moderation policy, or Hosted schema.

## Contract

### Site URL
- Resolve canonical origin from `NEXT_PUBLIC_SITE_URL` first.
- Fall back to `VERCEL_PROJECT_PRODUCTION_URL` when present.
- Fall back to `http://localhost:3000` only for local/CI builds.
- Normalize to an origin without trailing slash.

### Metadata
- Root metadata defines `metadataBase`, default title template, description, Open Graph and Twitter defaults.
- Ranking detail uses `seo_title`/`seo_description` when available, otherwise title/summary; canonical is `/rankings/<slug>`; only public-safe cover image is used.
- Item detail uses title/description; canonical is `/items/<slug>`; only public-safe item image is used.
- Category/subcategory clean URLs are indexable and canonical to themselves.
- Category/subcategory query variants using `sort`, `cursor`, or `facet` are `noindex,follow` and canonical to the clean path.
- `/search` is always `noindex,follow`; canonical is `/search`.
- `/admin`, `/me`, and `/login` are `noindex,nofollow`.

### Sitemap
- Generate `app/sitemap.ts` using only public-safe data.
- Include `/`, `/categories`, visible category/subcategory URLs, public rankings, and public items.
- Exclude search, query variants, admin/private routes, draft/hidden/blocked content.
- Use content update/publish timestamps when available.

### Robots
- Generate `app/robots.ts`.
- Allow public site crawl.
- Disallow `/admin/`, `/me/`, `/login`, and `/search`.
- Publish sitemap URL and host.

### Structured data
- Ranking detail emits sanitized JSON-LD: `ItemList` plus `BreadcrumbList`.
- Item detail emits sanitized `WebPage`/`Thing` plus `BreadcrumbList`; do not claim generic items are Products.
- Replace `<` with `\u003c` after JSON serialization.

### P1 closure
- Add `verify:p1-5` static contract verifier.
- CI sequence becomes P1-2 -> P1-3 -> P1-4 -> P1-5 -> lint -> build.
- README is reconciled to actual P1 completion and P2-next scope.

## Out of scope

- New DB migrations/indexes.
- Mass Facet SEO landing pages.
- Search query indexing.
- Dynamic OG image generation.
- Product schema claims for generic items.
- Analytics/search-console integration.
