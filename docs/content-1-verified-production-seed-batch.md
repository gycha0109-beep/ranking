# CONTENT-1 Verified Production Seed Batch

Status: **SUCCESS / CLOSED**

## Objective

CONTENT-1 validates the first real Production content workflow after OPS-1.

The goal is not to maximize document count. It is to prove that a small batch of source-backed rankings can move through research, structured authoring, OPS-1 readiness, publication, and Production rendering without weakening the editorial contract.

## Batch policy

The first batch deliberately uses objective official/public metrics rather than subjective recommendations.

Selection rules:

- primary or authoritative public source;
- directly reproducible ordering rule;
- explicit period and candidate scope;
- no fabricated evidence or missing ranks;
- exact `TOP N` title/entry consistency;
- reusable canonical items where rankings overlap;
- every ranking must report `editorial_ready=true` with zero OPS-1 blockers before publication.

## Production seed batch

### 1. 2024 명목 GDP TOP 5

Slug: `world-nominal-gdp-2024-top-5`

Authority:

- World Bank World Development Indicators
- indicator: `NY.GDP.MKTP.CD`
- source: `https://data.worldbank.org/indicator/NY.GDP.MKTP.CD`

Ordering used at publication:

1. 미국 — 약 28.75조 US$
2. 중국 — 약 18.74조 US$
3. 독일 — 약 4.69조 US$
4. 일본 — 약 4.03조 US$
5. 인도 — 약 3.91조 US$

World, region and income-group aggregate rows are excluded. The document states that World Bank historical values may be revised after publication.

### 2. 2024 인구 TOP 5

Slug: `world-population-2024-top-5`

Authority:

- World Bank World Development Indicators
- indicator: `SP.POP.TOTL`
- source: `https://data.worldbank.org/indicator/SP.POP.TOTL`

Ordering used at publication:

1. 인도 — 약 14.51억 명
2. 중국 — 약 14.09억 명
3. 미국 — 340,110,988명
4. 인도네시아 — 283,487,931명
5. 파키스탄 — 251,269,164명

Aggregate rows are excluded.

### 3. 2025 시도 순유입률 TOP 3

Slug: `korea-net-inmigration-rate-2025-top-3`

Authority:

- 국가데이터처 `2025년 국내인구이동통계 결과`
- published: 2026-01-29
- source: `https://sri.kostat.go.kr/board.es?act=view&bid=205&list_no=443278&mid=a10301020100&ref_bid=203%2C204%2C205%2C206%2C207%2C0073&tag=`

Ordering:

1. 인천 — 1.1%
2. 충북 — 0.7%
3. 충남 — 0.4%

### 4. 2025 시도 순유출률 TOP 3

Slug: `korea-net-outmigration-rate-2025-top-3`

Authority is the same official 2025 internal-migration release.

Ordering by stronger net outflow:

1. 광주 — -1.0%
2. 제주 — -0.6%
3. 울산 — -0.5%

## Canonical content created

CONTENT-1 added:

- category `통계` (`statistics`);
- subcategories `세계` (`world`) and `대한민국` (`korea`);
- seven reusable country items;
- six reusable Korean first-order region items;
- four published rankings;
- four criteria;
- four public authority source rows;
- sixteen ranking entries.

The existing OPS-1-reconciled weak/test content was not republished or reused as evidence.

## Publication execution

The seed operation used a fail-closed preflight for all intended slugs, created the batch as drafts, evaluated `private.ops_1_ranking_editorial_readiness` for every ranking, and only attempted publication after readiness passed.

A first execution exposed a local SQL variable-reuse mistake in the publication loop. Three rankings published while the GDP document remained a ready draft. No incomplete or non-ready document was published. A corrective transaction selected the GDP draft by exact slug, re-evaluated readiness, and published it. Final result: four published rankings, each with `editorial_ready=true` and zero blockers.

This execution note is retained because CONTENT-1 is intended to expose operational failure modes rather than hide them.

## Product defects discovered by real content

The pre-CONTENT-1 ranking type contract had no neutral metric type. The seed rankings temporarily used `purpose`, which rendered the public badge as `목적별 추천`. That label is semantically wrong for deterministic official-statistic rankings.

CONTENT-1 therefore adds `metric` as a first-class ranking type and maps it to `공식 지표` on the public surface.

A second presentation defect was also found: `editor_score` was rendered with a star icon and one decimal place, which incorrectly turned raw GDP/population/rate values into rating-like scores. Metric rankings no longer render `editor_score` as a star rating. Their explicit metric labels and formatted values are stored in `score_json.scores` instead.

## Metric contract change

Migration:

- `20260819020000_content_1_metric_ranking_type.sql`

Contract:

- preserves every existing ranking type;
- adds `metric`;
- public label is `공식 지표`;
- metric rankings do not display `editor_score` as a rating;
- admin creation/edit surfaces expose `metric`;
- `verify:content-1` guards the contract in CI.

## Timing evidence

CONTENT-1 began at approximately 2026-08-19 09:35 KST. The four source-backed documents reached published + zero-blocker state at approximately 09:43 KST.

This is roughly eight minutes of AI-assisted batch wall-clock for source selection, source verification, schema/preflight inspection, structured seed authoring, readiness evaluation and publication. It is not a human manual-authoring benchmark, and the four documents share sources/items, so dividing it into an independent per-document labor estimate would be misleading.

Metric taxonomy hardening and repository lifecycle validation are tracked separately from that initial content-production interval.

## Implementation evidence

Implementation PR: `#43` — `feat: harden CONTENT-1 metric rankings`

- exact validated head: `314b3da9a932bc3638bd0d134e5a7f866e23371b`
- authoritative CI: run `#208`, workflow run `32203091724`
- all existing P1/P2/P2-3/OPS-1/UI-1/LAUNCH-1 verifiers: PASS
- `verify:content-1`: PASS
- lint: PASS
- production build: PASS
- merge/main: `3bd78b59c842e4be19ccebddc46369f24916f7b7`
- validated head → merge file delta: zero

Hosted migration `content_1_metric_ranking_type` was applied before the Production data conversion. The final ranking-type constraint preserves all prior types and adds `metric`.

## Production conversion evidence

After exact merged main deployed READY, a fail-closed transaction converted only the four known CONTENT-1 documents from temporary `purpose` to `metric`.

Preconditions required:

- exactly four target rankings;
- all four `published` and `purpose`;
- all four OPS-1 editorial-ready;
- sixteen existing `editor_score` values.

The transaction:

1. preserved each original `published_at`;
2. temporarily unpublished the four documents;
3. changed `ranking_type` to `metric`;
4. removed all sixteen rating-style `editor_score` values;
5. wrote one explicit metric label/value into `score_json.scores` for every entry;
6. republished the documents with their original first-publication timestamps;
7. forced deferred publication constraints before commit;
8. asserted four published, ready metric rankings as a postcondition.

Final target state:

- published metric rankings: `4`
- CONTENT-1 entries: `16`
- non-null CONTENT-1 `editor_score`: `0`
- entries with explicit metric score: `16`
- not editorial-ready: `0`
- rankings with blockers: `0`

## Production acceptance

Vercel Production deployment:

- deployment: `dpl_2ThzvvpgkSjDy8NqFK1BRKKiFARH`
- exact main SHA: `3bd78b59c842e4be19ccebddc46369f24916f7b7`
- target: `production`
- state: `READY`
- GitHub Vercel status: `success`

Public acceptance passed on the canonical Production origin:

- home: HTTP 200 and all four recent published rankings visible;
- `/categories/statistics`: HTTP 200, both `세계`/`대한민국` subcategories visible, four published rankings visible;
- all four ranking details: HTTP 200;
- ranking badge: `공식 지표`;
- explicit metric values visible without rating-star score presentation;
- source, scope, criterion, ranking order and JSON-LD remain intact;
- `GDP` search returns `2024 명목 GDP TOP 5`;
- `순유입` search returns `2025 시도 순유입률 TOP 3`;
- Production runtime error clusters during acceptance: `0`.

Hosted final inventory after CONTENT-1:

- rankings: `6` total = `4 published / 1 draft / 1 archived`;
- published metric rankings: `4`;
- items: `19` total = `15 active / 4 archived`;
- sponsors: `0`;
- sponsorships: `0`;
- legacy `sponsor_flag=true`: `0`.

## Bottleneck conclusion

CONTENT-1 does **not** provide evidence that external crawling/import is currently the limiting factor.

The first four authoritative documents were sourced, structured and published quickly enough with the current assisted workflow that building the large P2-4 ingestion subsystem now would be premature. The observed defects were domain/presentation issues (`metric` semantics), not source-acquisition throughput failures.

External ingestion therefore remains deferred until repeated Production content expansion shows a measurable sourcing, normalization, deduplication or update-maintenance bottleneck.

## Close result

All nine close conditions passed:

1. exact-head CI with all legacy gates and `verify:content-1`;
2. Hosted metric migration applied;
3. PR merged without tree drift;
4. exact merged main deployed READY;
5. four rankings converted to `metric` with first publication timestamps preserved;
6. explicit metric scores present and rating-style editor scores removed;
7. home/detail/category/search surfaces accepted;
8. Hosted readback shows four published, ready, blocker-free metric rankings;
9. Production runtime errors clean.

**CONTENT-1 = SUCCESS / CLOSED**

## Next lifecycle

`CONTENT-2 — Production Editorial Expansion / Coverage Batch`

CONTENT-2 should expand source-backed Production coverage across multiple categories and measure repeatable authoring/update cost. External import/crawling remains deferred until that expansion produces concrete bottleneck evidence.
