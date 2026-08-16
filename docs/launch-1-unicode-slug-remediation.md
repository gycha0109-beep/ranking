# LAUNCH-1 Unicode Slug Remediation

## Status

Implementation candidate under validation.

## Production finding

The first Vercel production deployment for `main@f63c07d5707509432c03f2ee6824264385e010cd` exposed an inconsistency for non-ASCII public slugs.

- `/items/heo_steam` returned 200.
- active/clean Korean item slugs such as `테스트` were included in the public sitemap.
- requesting `/items/테스트` returned 404.
- the runtime route parameter observed in the production response was percent-encoded.
- SEO metadata and page data therefore diverged for the same public row.

Hosted read-only inspection confirmed four active/clean non-ASCII item slugs. No data cleanup is part of this remediation.

## Contract

1. Preserve stored slugs and public moderation/status predicates.
2. Normalize percent-encoded route slug input exactly once before public slug equality queries.
3. Use the same normalization for public data queries and SEO snapshots.
4. Preserve ASCII slugs unchanged.
5. If percent decoding is malformed, preserve the original value rather than raising a server error.
6. Cover category, subcategory, ranking, and item slug lookup boundaries defensively.
7. Do not change database schema, RLS, RPCs, sitemap inclusion predicates, or canonical construction.

## Implementation

- `src/lib/routing.ts`
  - introduces `normalizeRouteSlug`.
- `src/lib/queries/public.ts`
  - normalizes slug inputs before public equality queries.
- `src/lib/seo.ts`
  - applies the identical normalization before SEO snapshot queries.
- `scripts/verify-launch-1-contracts.mjs`
  - locks shared normalization and malformed-encoding fallback into the LAUNCH-1 CI contract.

## Validation gates

- existing P1/P2/UI-1 verifiers
- LAUNCH-1 verifier
- lint
- Next.js production build
- exact-head CI
- PR CI
- explicit merge approval
- merged-main exact-SHA CI
- Vercel exact-SHA deployment
- production regression request for a Korean item slug

## Out of scope

- test/demo content editorial cleanup
- changing existing slug values
- image storage migration
- OG image policy remediation
- crawler/import work
