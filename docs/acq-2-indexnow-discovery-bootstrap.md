# ACQ-2 — IndexNow Discovery Bootstrap

Status: **SUCCESS / CLOSED**

## Objective

ACQ-2 adds a bounded search-discovery notification path after CONTENT-5 without pretending that URL submission is the same thing as crawl or indexing.

The stage exists because the application is technically crawlable, CONTENT-5 is published, and MEASURE-1 has not yet accumulated enough baseline-eligible demand to justify another product feature. ACQ-1 already prepared optional Google/Bing property-verification metadata, but external ownership confirmation is still unavailable.

Starting authority:

- main: `50d97147edecd9120f5e00115522990bbd280eb6`
- CONTENT-5: `SUCCESS / CLOSED`
- ACQ-1 code readiness: closed; external engine ownership remains pending/unconfirmed
- MEASURE-1 durable `unknown` events at stage audit: 3 total, with no post-CONTENT-5 event yet
- IA-2 organic semantic governance events: 0
- Production origin: `https://ranking-rho-three.vercel.app`

## Evidence boundary

ACQ-2 freezes these states as distinct:

```text
TECHNICALLY_CRAWLABLE
    != INDEXNOW_KEY_REACHABLE
    != INDEXNOW_REQUEST_RECEIVED
    != CRAWLED
    != INDEXED
```

A successful IndexNow HTTP response means only that the notification was received or accepted for key validation. It is not evidence that a search engine crawled or indexed the URL.

ACQ-2 does not modify the ACQ-1 authority split:

```text
OWNERSHIP_VERIFIED
    != SITEMAP_SUBMITTED
    != INDEXED
```

Google Search Console ownership, Bing Webmaster ownership, sitemap submission, URL inspection, crawl state, and index state remain external engine authorities.

## Protocol ownership key

The repository hosts one IndexNow protocol key at the Production root:

```text
/0fc5987ce02e929b5fcd9b1223ae985e81fd8c41e9d2dc381513970419411722.txt
```

The file is UTF-8 text and its contents equal the filename stem exactly. It is a public host-verification artifact, not an application credential and not a replacement for Google/Bing property verification.

Rotating the key requires changing both the root file and the submitter contract together.

## Operator submission contract

`scripts/submit-indexnow.mjs` provides the bounded submission path.

Safety rules:

1. Default execution is `DRY_RUN` and makes no network request.
2. Live submission requires explicit `--submit`.
3. The site origin comes from `--site` or `NEXT_PUBLIC_SITE_URL`.
4. Every submitted URL must resolve to exactly the same origin as the site.
5. Fragments are removed and duplicate URLs are collapsed.
6. At least one URL is required.
7. One request is capped at 10,000 URLs.
8. The key is loaded from the checked-in root key file and the filename must match its contents.
9. Submission uses the universal `https://api.indexnow.org/indexnow` endpoint with `host`, `key`, `keyLocation`, and `urlList`.
10. HTTP 200 is recorded as `RECEIVED`.
11. HTTP 202 is recorded as `RECEIVED_KEY_VALIDATION_PENDING`.
12. Any other HTTP status fails the command.
13. CI never performs a live submission.

Example dry-run:

```bash
npm run indexnow:submit -- \
  --site https://ranking-rho-three.vercel.app \
  --url /rankings/top500-supercomputer-hpl-rmax-2026-06-top-5
```

Live operator execution adds `--submit` only after the key file is reachable on the same deployed Production origin.

## Initial bootstrap URL set

The initial live bootstrap is intentionally limited to URLs added or materially updated by CONTENT-5:

- home: 1
- affected top-level categories: 3
- new subcategories: 3
- new ranking details: 3
- new canonical item details: 15

Total: **25 URLs**.

The bootstrap must not submit the entire historical sitemap merely because it exists. Subsequent operations should notify IndexNow when a public URL is added, materially updated, or deleted.

## Preserved boundaries

ACQ-2 does not:

- claim Google Search Console or Bing Webmaster ownership;
- claim sitemap submission to an engine dashboard;
- claim crawl or indexing from an IndexNow response;
- add a crawler or scraper;
- alter ranking publication state or ranking values;
- alter robots, sitemap, canonical, or LAUNCH-2 publication filtering;
- add database schema, RLS, RPC, telemetry identity, or analytics tracking;
- submit from CI or on every build;
- repeatedly resubmit unchanged historical URLs;
- create fake Google/Bing verification tokens.

## Exit criteria

ACQ-2 may close only when:

1. the root key file satisfies the IndexNow key syntax and filename/content contract;
2. the bounded submitter and dry-run behavior are verifier-protected;
3. package and CI expose/run the ACQ-2 verifier without making a live request;
4. all historical verifiers, lint, and Next production build pass at the exact PR head;
5. merge occurs without `main` drift;
6. exact merged-main Production deployment is READY;
7. the exact root key URL returns HTTP 200 with the expected key contents;
8. the 25-URL CONTENT-5 bootstrap is submitted only after key reachability is proven;
9. the submission response is recorded as protocol receipt only, not indexing evidence;
10. Production runtime error/fatal and 5xx checks show no regression;
11. external search-result sampling, if performed, remains advisory and is not promoted to authoritative indexing evidence.

## Closure evidence

### Implementation authority

- implementation PR: `#81`
- exact implementation PR head: `82e9253eb39e4f397ff15c3fc01a3065112f439b`
- exact-head CI: `#330` / `SUCCESS`
- historical verifier suite: `PASS`
- ACQ-2 verifier: `PASS`
- lint: `PASS`
- Next production build: `PASS`
- merged main after implementation: `81c114a7578fbc9694cd64de2603b77c43b7021b`

The implementation merge occurred from the CI-verified head without observed `main` drift.

### Production key reachability

Exact implementation Production deployment:

```text
deployment = dpl_8C8h9YPenBigkJR6xdGz8UNdSkTh
git_sha = 81c114a7578fbc9694cd64de2603b77c43b7021b
state = READY
```

The IndexNow key was then read back from both:

- the exact deployment URL; and
- the canonical Production alias `https://ranking-rho-three.vercel.app`.

Both returned HTTP 200 with the exact expected key text:

```text
0fc5987ce02e929b5fcd9b1223ae985e81fd8c41e9d2dc381513970419411722
```

Therefore:

```text
INDEXNOW_KEY_REACHABLE = VERIFIED
```

### Live CONTENT-5 bootstrap receipt

The live submission was isolated from `main` and normal CI through one disposable operator branch and draft PR:

- operator PR: `#82`
- title boundary: `DO NOT MERGE`
- PR outcome: `CLOSED / UNMERGED`
- exact operator head used for the inspected run: `a02ca5750acaab42da9bf7ed670c819cb08669a1`
- inspected workflow: `ACQ-2 IndexNow Bootstrap`
- workflow run id: `32536319327`
- workflow run number: `2`
- submit job id: `96937815582`

The inspected live submission returned:

```text
state = RECEIVED
status = 200
host = ranking-rho-three.vercel.app
urlCount = 25
```

This is authoritative evidence only for IndexNow protocol receipt of that 25-URL request. It is not evidence of crawl, ranking, visibility, or indexing.

The inspected request contained only the bounded CONTENT-5 bootstrap set documented above. It did not submit the entire historical sitemap.

Operational note: the workflow numbering shows that an earlier run `#1` existed while the disposable execution vehicle was being prepared. Its outcome was not independently inspected and is not used as ACQ-2 closure evidence. The authoritative receipt evidence for closure is run `#2` above.

After the inspected run:

- PR `#82` was closed without merge; and
- the disposable one-shot workflow was removed from its operator branch in commit `20024b8e5236abc1efc6fce026f0ab9f3cf85cf9`.

No live-submission workflow was merged into `main`.

### Runtime safety

After the exact implementation deployment and key/submission checks:

```text
recent_production_runtime_errors = 0
exact_deployment_5xx = 0
```

No database, RLS, publication-state, ranking-value, robots, sitemap, or canonical mutation was introduced by ACQ-2.

### External authority remains unresolved

ACQ-2 does not close ACQ-1's external ownership boundary. Google Search Console ownership, Bing Webmaster ownership, engine-side sitemap submission/readback, crawl state, and indexed state remain dependent on external search-engine authority.

Therefore the following statements remain mandatory:

```text
ACQ_1_OPERATIONAL_VERIFICATION = PENDING_EXTERNAL_ENGINE_OWNERSHIP
CRAWL_STATUS = UNCONFIRMED
SEARCH_ENGINE_INDEXING = UNCONFIRMED
```

## Final state

```text
ACQ_2_CODE_READINESS = SUCCESS
INDEXNOW_KEY_REACHABLE = VERIFIED
INDEXNOW_CONTENT_5_BOOTSTRAP = RECEIVED / HTTP 200 / 25 URLs
CRAWL_STATUS = UNCONFIRMED
SEARCH_ENGINE_INDEXING = UNCONFIRMED
ACQ_2 = SUCCESS / CLOSED
```
