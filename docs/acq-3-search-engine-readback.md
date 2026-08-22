# ACQ-3 — Search Engine Ownership, Sitemap Readback & Crawl/Index Observability

Status: **READBACK CONTRACT SUCCESS / EXTERNAL ENGINE AUTHORITY BLOCKED**

## Objective

ACQ-3 turns the remaining ACQ-1/ACQ-2 search-engine authority gap into an explicit operator readback contract.

It does not manufacture ownership, sitemap submission, crawl, or indexing evidence from public HTML or IndexNow receipt.

The evidence boundary is:

```text
TECHNICALLY_CRAWLABLE != OWNERSHIP_VERIFIED != SITEMAP_SUBMITTED != CRAWLED != INDEXED
```

A verification meta tag is only a verification surface. It is not proof that Google Search Console or Bing Webmaster accepted the property.

## Starting authority

Authoritative starting `main`:

```text
bac3a47eb287954bb36e0e257402133b1692022b
```

Production at ACQ-3 audit start:

```text
deployment = dpl_8EYKxEJSsz9idPA8A8f7hvYfJXuM
git_sha = bac3a47eb287954bb36e0e257402133b1692022b
state = READY
origin = https://ranking-rho-three.vercel.app
```

Inherited states:

```text
ACQ_2 = SUCCESS / CLOSED
INDEXNOW_CONTENT_5_BOOTSTRAP = RECEIVED / HTTP 200 / 25 URLs
CRAWL_STATUS = UNCONFIRMED
SEARCH_ENGINE_INDEXING = UNCONFIRMED
```

## Production readback — 2026-08-23 KST

The canonical Production origin was read directly.

### Root

```text
GET / = HTTP 200
ROBOTS_META = index, follow
CANONICAL = https://ranking-rho-three.vercel.app
GOOGLE_VERIFICATION_TAG = ABSENT
BING_VERIFICATION_TAG = ABSENT
```

The application code still supports engine-issued tokens through:

```text
GOOGLE_SITE_VERIFICATION
BING_SITE_VERIFICATION
```

but neither tag is currently rendered in Production. Therefore no claim is made that either token is configured.

### robots.txt

```text
GET /robots.txt = HTTP 200
ALLOW_PUBLIC_ROOT = YES
PRIVATE_SURFACES_DISALLOWED = /admin, /me, /login
SITEMAP_ADVERTISED = https://ranking-rho-three.vercel.app/sitemap.xml
```

### sitemap.xml

```text
GET /sitemap.xml = HTTP 200
PUBLIC_CATEGORY_URLS = PRESENT
PUBLIC_SUBCATEGORY_URLS = PRESENT
PUBLIC_RANKING_URLS = PRESENT
PUBLIC_ITEM_URLS = PRESENT
```

The sitemap remains generated from the existing LAUNCH-2 public authority. No ACQ-3 migration, publication-state mutation, ranking mutation, or crawler was introduced.

## Public search sampling

Public search sampling was performed for the Production host and current canonical ranking/item URLs.

The sampled searches returned no matching result.

This is recorded only as:

```text
PUBLIC_SEARCH_SAMPLING = NO_RESULTS / ADVISORY_ONLY
```

This must not be interpreted as proof that Google or Bing has never crawled the site, and it must not be used as an exhaustive index inventory.

## External authority readback

No connected Search Console / Bing Webmaster authority is available to this Stage, and no engine-issued verification tag is present in Production.

Accordingly:

```text
GOOGLE_SEARCH_CONSOLE_OWNERSHIP = UNCONFIRMED
BING_WEBMASTER_OWNERSHIP = UNCONFIRMED
ENGINE_SIDE_SITEMAP_READBACK = UNCONFIRMED
CRAWL_STATUS = UNCONFIRMED
SEARCH_ENGINE_INDEXING = UNCONFIRMED
EXTERNAL_ENGINE_AUTHORITY_BLOCKED
```

This is an external authority blocker, not an application crawlability blocker.

## ACQ-3 operator

`scripts/readback-acq-3-search-engine.mjs` performs bounded public-site readback.

Example:

```bash
npm run acq-3:readback -- \
  --site https://ranking-rho-three.vercel.app
```

It validates:

1. Production root returns HTTP 200;
2. root exposes `index, follow`;
3. root canonical points to the selected Production origin;
4. `robots.txt` is reachable and advertises the canonical sitemap;
5. `sitemap.xml` is reachable;
6. sitemap URLs are same-origin and duplicate-free;
7. at least one ranking and one item detail URL are present;
8. sampled ranking/item details return HTTP 200 with `index, follow` and matching canonicals;
9. Google/Bing verification-tag presence is reported without printing token values.

Optional explicit tag gates are available only after real engine-issued tokens are configured:

```bash
npm run acq-3:readback -- \
  --site https://ranking-rho-three.vercel.app \
  --require-google-tag \
  --require-bing-tag
```

Even when these flags pass, the operator still reports engine ownership, sitemap submission, crawl, and index state as `UNCONFIRMED`. Those states require the engine's own property/dashboard/API authority.

## Required external closure sequence

Positive ACQ-3 external closure requires all applicable engine-side evidence to be collected separately.

### Google

1. Create/open the exact Production URL-prefix property.
2. Obtain the engine-issued verification token.
3. Configure `GOOGLE_SITE_VERIFICATION` in Production.
4. Redeploy and run ACQ-3 readback with `--require-google-tag`.
5. Complete Search Console property verification.
6. Submit/read back `https://ranking-rho-three.vercel.app/sitemap.xml` in Search Console.
7. Record engine-side URL inspection/index evidence for bounded canonical samples.

### Bing

1. Create/open the exact Production site in Bing Webmaster Tools.
2. Obtain the engine-issued verification token.
3. Configure `BING_SITE_VERIFICATION` in Production.
4. Redeploy and run ACQ-3 readback with `--require-bing-tag`.
5. Complete Bing property verification.
6. Submit/read back the same sitemap in Bing Webmaster Tools.
7. Record engine-side crawl/index evidence for bounded canonical samples.

## Prohibited shortcuts

ACQ-3 must not:

- generate fake Google/Bing verification tokens;
- treat a rendered verification tag as ownership acceptance;
- treat IndexNow HTTP 200 as crawl or indexing;
- treat a public `site:` query as authoritative index inventory;
- store search-engine account credentials in the repository;
- add invasive tracking, fingerprinting, or referrer logging merely to compensate for missing engine authority;
- change canonical origin or adopt a custom domain implicitly.

## Implementation closure evidence

The application-side readback contract was implemented and merged without changing ranking data, publication state, canonical origin, database schema, RLS, or analytics identity.

```text
implementation_pr = #92
implementation_exact_head = 7aa5cb2e06feaf5b12ffa90cacce67b7f48bc466
exact_head_ci = #363 / run 32593928418 / SUCCESS
merged_main = 7b5a9780defc1c04ae2017762f69749802afa46d
```

The exact merged-main Production deployment is:

```text
deployment = dpl_CQy5rTtKKra24PCtsLvMkxY7EZRT
git_sha = 7b5a9780defc1c04ae2017762f69749802afa46d
state = READY
canonical_alias = ranking-rho-three.vercel.app
```

Post-merge canonical readback confirmed:

```text
GET / = HTTP 200 / index, follow / canonical exact
GET /robots.txt = HTTP 200 / Allow: / / canonical sitemap advertised
GET /sitemap.xml = HTTP 200 / public category, subcategory, ranking, item URLs present
GET /rankings/top500-supercomputer-hpl-rmax-2026-06-top-5 = HTTP 200 / index, follow / canonical exact
GET /items/lineshine = HTTP 200 / index, follow / canonical exact
```

Operational safety readback after the merged deployment:

```text
recent_production_runtime_errors = 0
exact_deployment_5xx = 0
open_prs_before_closeout = 0
```

## Current terminal state

The repository and Production now have a CI-protected, bounded application-side readback contract. The external ownership objective cannot be truthfully closed without engine-side property access.

Therefore:

```text
ACQ_3_READBACK_CONTRACT = SUCCESS / CLOSED
TECHNICAL_CRAWLABILITY = VERIFIED
GOOGLE_VERIFICATION_TAG = ABSENT
BING_VERIFICATION_TAG = ABSENT
GOOGLE_SEARCH_CONSOLE_OWNERSHIP = UNCONFIRMED
BING_WEBMASTER_OWNERSHIP = UNCONFIRMED
ENGINE_SIDE_SITEMAP_READBACK = UNCONFIRMED
CRAWL_STATUS = UNCONFIRMED
SEARCH_ENGINE_INDEXING = UNCONFIRMED
ACQ_3_EXTERNAL_CLOSURE = BLOCKED_EXTERNAL_ENGINE_AUTHORITY
EXTERNAL_ENGINE_AUTHORITY_BLOCKED
```

The application-side ACQ-3 contract is closed. The external engine states must remain unconfirmed until actual engine authority is obtained.
