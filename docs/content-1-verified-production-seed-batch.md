# CONTENT-1 Verified Production Seed Batch

Status: **PRODUCTION SEED PUBLISHED / METRIC CONTRACT PR VALIDATION PENDING**

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

## Product defect discovered by real content

The pre-CONTENT-1 ranking type contract had no neutral metric type. The seed rankings temporarily used `purpose`, which rendered the public badge as `목적별 추천`. That label is semantically wrong for deterministic official-statistic rankings.

CONTENT-1 therefore adds `metric` as a first-class ranking type and maps it to `공식 지표` on the public surface.

A second presentation defect was also found: `editor_score` is rendered with a star icon and one decimal place, which incorrectly turns raw GDP/population/rate values into rating-like scores. Metric rankings therefore do not render `editor_score` as a star rating. Their explicit metric labels and formatted values are stored in `score_json.scores` instead.

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

## Close conditions

CONTENT-1 closes only after:

1. `metric` contract exact-head CI passes with all legacy gates;
2. the migration is applied to Hosted Production;
3. the implementation PR merges without tree drift;
4. exact merged main deploys READY on Vercel;
5. the four Production rankings are changed from temporary `purpose` to `metric` without changing their first publication timestamps;
6. all metric entries use explicit `score_json` metric values and no rating-style `editor_score` presentation;
7. public home/detail/category/search surfaces expose the batch correctly;
8. Hosted final readback shows all four published, ready, and blocker-free;
9. Production runtime errors remain clean after acceptance.
