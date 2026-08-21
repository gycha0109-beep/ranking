# ACQ-1 — Search Engine Ownership & Submission Readiness

Status: implementation / verification stage

Starting authority:

- accepted main: `80e4916496a56da21ad647e671178d6bebd85115`
- LAUNCH-2: CLOSED
- semantic track: `WAITING_FOR_ORGANIC_EVIDENCE`
- Production host: `https://ranking-rho-three.vercel.app`

## 1. Why this Stage exists

LAUNCH-2 closed the application-side publication/index hygiene boundary. Public pages now expose only publish-authorized content, robots and sitemap are reachable, and canonical URLs use the Production origin.

However, search-engine discovery has no positive operational evidence yet. At audit time:

- exact-title searches returned no result for sampled Ranking pages;
- site/domain searches returned no result;
- the Production home HTML contained no Google or Bing ownership-verification meta tag;
- the repository had no Search Console/Bing verification-token contract.

These observations do **not** prove that an engine has never crawled or indexed the site. Public search-result sampling is weak evidence and must not be promoted into an authoritative indexing claim.

## 2. Evidence states

ACQ-1 separates four states that must not be collapsed:

```text
TECHNICALLY_CRAWLABLE
    != OWNERSHIP_VERIFIED
    != SITEMAP_SUBMITTED
    != INDEXED
```

### TECHNICALLY_CRAWLABLE

May be asserted when Production evidence confirms:

- public route returns 200 and `index, follow`;
- canonical URL points to the intended Production origin;
- `robots.txt` allows the public route family;
- `sitemap.xml` is 200 and contains only publication-authorized URLs.

### OWNERSHIP_VERIFIED

May be asserted only after the relevant search engine accepts the site/property verification token. Rendering a verification meta tag is necessary evidence for tag-based verification, but is not itself proof that the engine accepted the property.

### SITEMAP_SUBMITTED

May be asserted only from the search engine's own property/dashboard/API evidence showing that the Production sitemap was submitted or discovered under the verified property.

### INDEXED

May be asserted only from search-engine evidence that a URL is indexed. Search-result sampling, including `site:` queries, is advisory evidence only and must not be treated as an exhaustive index inventory.

## 3. Verification-token contract

The root Next.js metadata contract supports two optional server environment variables:

```text
GOOGLE_SITE_VERIFICATION
BING_SITE_VERIFICATION
```

Rules:

1. Values must be copied exactly from the search engine that issued them.
2. Empty or whitespace-only values render no verification tag.
3. No fallback, sample, synthetic, or guessed token may be emitted in Production.
4. Tokens are configured as server environment variables, not hard-coded source constants.
5. Google renders through Next.js `verification.google` as `google-site-verification`.
6. Bing renders through Metadata `verification.other` as `msvalidate.01`.
7. Adding or rotating a token does not imply ownership verification until the external engine confirms it.

Although verification strings are designed to be public in HTML, keeping their configuration outside source avoids source changes for engine-issued token rotation and prevents fake placeholder values from becoming Production claims.

## 4. Existing crawl authority remains unchanged

ACQ-1 does not replace or duplicate the existing SEO authority:

- `NEXT_PUBLIC_SITE_URL` remains the canonical Production origin contract.
- `src/app/robots.ts` remains the crawler allow/disallow contract.
- `src/app/sitemap.ts` remains the sitemap renderer.
- `getPublicSitemapRows()` continues to inherit the LAUNCH-2 publication boundary through the anon public DB authority.
- Ranking/Item page metadata continues to own page-level canonical and robots behavior.

Search-engine verification is an ownership layer, not a publication layer.

## 5. Operator sequence after code deployment

The required operational sequence is:

```text
1. Choose the stable Production origin/property.
2. Create or open the Google Search Console property.
3. Obtain the Google verification token.
4. Configure GOOGLE_SITE_VERIFICATION in Production.
5. Deploy and confirm the exact token appears in Production HTML.
6. Complete Google property verification.
7. Submit https://<production-origin>/sitemap.xml.
8. Record engine-side sitemap state and URL inspection evidence.

9. Create or open the Bing Webmaster property.
10. Obtain the Bing verification token.
11. Configure BING_SITE_VERIFICATION in Production.
12. Deploy and confirm the exact token appears in Production HTML.
13. Complete Bing property verification.
14. Submit the same Production sitemap.
15. Record engine-side crawl/index evidence separately.
```

If a custom domain is adopted later, that is a host migration and requires a separate canonical/redirect/property migration plan. ACQ-1 does not silently change the current Vercel Production origin.

## 6. Current authority ceiling

Until external engine credentials/property access are available and the engine confirms ownership:

```text
ACQ_1_CODE_READINESS = eligible for closure after CI + Production deployment
ACQ_1_OPERATIONAL_VERIFICATION = PENDING_EXTERNAL_ENGINE_OWNERSHIP
SEARCH_ENGINE_INDEXING = UNCONFIRMED
```

This is not an application blocker. Public content remains available and crawlable. It is an acquisition-evidence limitation.

## 7. Exit criteria

ACQ-1 code readiness may close only when:

1. root metadata supports optional Google and Bing verification tokens;
2. unset tokens emit no fake verification metadata;
3. `.env.example` documents both token names without values;
4. canonical/robots/sitemap contracts remain unchanged;
5. a verifier freezes the distinction between technical crawlability, ownership verification, sitemap submission, and indexing;
6. exact-head CI, historical verifiers, lint, and production build pass;
7. exact merge-SHA Production deployment remains READY and public crawl/index metadata has no regression.

Operational verification remains pending until engine-side confirmation exists. Code-readiness closure must never be reported as `INDEXED`.