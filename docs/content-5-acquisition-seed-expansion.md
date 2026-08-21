# CONTENT-5 Acquisition Seed Expansion

Status: **SUCCESS / CLOSED**

## Objective

CONTENT-5 expands the small Production corpus with a deliberately bounded acquisition seed. The goal is not blind document growth. It is to add a few high-intent, source-backed rankings from source shapes not yet represented in Production while preserving the existing OPS-1 publication contract and CONTENT-3 revalidation lifecycle.

Starting authority:

- main: `b4b8cec383a4d645eacfb2e6a77f15c47fee9eed`
- published rankings: 13
- public corpus: 40 items across 4 categories / 6 subcategories
- open PRs at start: 0
- ACQ-1 code readiness: CLOSED
- external search-engine ownership/indexing evidence: still pending/unconfirmed

## Batch policy

Every CONTENT-5 ranking must satisfy the existing CONTENT-1/2/4 rules:

- primary or authoritative public source;
- deterministic and reproducible ordering;
- explicit target, period and method scope;
- exact TOP N / entry-count consistency;
- active canonical items only;
- explicit public reason for every entry;
- at least one complete criterion;
- at least one directly usable public source URL;
- metric value stored in `score_json.scores`;
- rating-style `editor_score` remains null;
- `private.ops_1_ranking_editorial_readiness()` must return `editorial_ready=true` with zero blockers before publication.

No existing weak/test draft is promoted as part of this stage.

## Verified candidate 1 — TOP500 supercomputer HPL performance

Planned title: `2026년 6월 TOP500 슈퍼컴퓨터 성능 TOP 5`

Planned slug: `top500-supercomputer-hpl-rmax-2026-06-top-5`

Authority:

- TOP500 June 2026 list
- `https://www.top500.org/lists/top500/2026/06/`
- detailed list: `https://www.top500.org/lists/top500/list/2026/06/?page=1`

Ordering rule:

- HPL `Rmax` descending;
- values are published by TOP500 in PFlop/s.

Verified top five:

1. LineShine — 2,198.40 PFlop/s
2. El Capitan — 1,809.00 PFlop/s
3. Frontier — 1,353.00 PFlop/s
4. Aurora — 1,012.00 PFlop/s
5. JUPITER Booster — 1,000.00 PFlop/s

Planned taxonomy:

- category: `기술` (`technology`)
- subcategory: `슈퍼컴퓨터` (`supercomputers`)
- item type: `supercomputer`

## Verified candidate 2 — ACI World final 2025 airport passenger traffic

Planned title: `2025 세계 공항 이용객 수 TOP 5`

Planned slug: `world-busiest-airports-passengers-2025-top-5`

Authority:

- Airports Council International (ACI) World — final 2025 airport traffic ranking, July 2026
- `https://aci.aero/resources/busiest-airports-in-the-world/`
- final dataset announcement: `https://aci.aero/2026/07/15/worlds-busiest-airports-atlanta-holds-asia-climbs-strong-demand-while-asia-pacific-growth-reshape-the-rankings/`

Ordering rule:

- total 2025 passengers descending;
- ACI definition: enplaned and deplaned passengers, with passengers in transit counted once.

Verified final top five:

1. Hartsfield-Jackson Atlanta International Airport (ATL) — 106,302,208
2. Dubai International Airport (DXB) — 95,192,160
3. Tokyo Haneda Airport (HND) — 91,679,814
4. Dallas/Fort Worth International Airport (DFW) — 85,660,127
5. Shanghai Pudong International Airport (PVG) — 84,994,548

The April 2026 preliminary ACI value for Shanghai differed slightly. CONTENT-5 uses the July 2026 final ACI figure above and must not reuse preliminary data.

Planned taxonomy:

- category: `여행·교통` (`travel-transport`)
- subcategory: `공항` (`airports`)
- item type: `airport`

## Verified candidate 3 — UN DESA 2025 city population

Planned title: `2025 세계 도시 인구 TOP 5`

Planned slug: `world-largest-cities-population-2025-top-5`

Authority:

- United Nations Department of Economic and Social Affairs, Population Division
- World Urbanization Prospects 2025
- `https://www.un.org/development/desa/pd/world-urbanization-prospects-2025`
- download catalog: `https://population.un.org/wup/downloads?tab=Cities`

Ordering rule:

- population as of 1 July 2025 descending;
- use the harmonized Degree of Urbanization definition from WUP 2025;
- values stored as persons, derived from the official table values reported in thousands.

Verified top five from Table A4:

1. Jakarta, Indonesia — 41,914,000
2. Dhaka, Bangladesh — 36,585,000
3. Tokyo, Japan — 33,413,000
4. New Delhi, India — 30,222,000
5. Shanghai, China — 29,559,000

Planned taxonomy:

- existing category: `통계` (`statistics`)
- new subcategory: `세계 도시` (`world-cities`)
- item type: `city`

A separate `world-cities` subcategory is intentional. Reusing the broad existing `world` subcategory would increase false semantic proximity between country-level population/GDP rankings and city-level population rankings.

## Canonical item contract

The planned 15 item slugs were checked against Production before authoring and none currently exists. The new item types remain open-world values; the database has no closed `item_type` enum. UI-2C remains a generic renderer.

CONTENT-5 adds user-facing machine-label translations only for:

- `city` → `도시`
- `airport` → `공항`
- `supercomputer` → `슈퍼컴퓨터`

No domain-specific detail page is introduced.

## Publication / revalidation plan

The Production write must be a single fail-closed transaction:

1. reassert exact ranking/category/subcategory/item slug non-collision;
2. create required taxonomy and 15 canonical items;
3. create all three rankings as drafts;
4. add criteria, public sources, entries, reasons and explicit metric values;
5. evaluate OPS-1 readiness for all three;
6. abort if any ranking is not ready or has blockers;
7. publish all three only after all pass;
8. record an initial CONTENT-3 `verified_unchanged` revalidation event for each published ranking with a source-appropriate next review date;
9. force relevant deferred constraints before commit;
10. read back exact published state and zero-blocker readiness.

Semantic projection is intentionally not required for publication. Projection absence remains a valid unclassified state under IA-2.

## Boundaries

CONTENT-5 does not:

- purchase or configure a domain;
- claim Google/Bing ownership or indexing;
- add a crawler or bulk import subsystem;
- revive the weak `2026 닭가슴살 TOP 10` draft;
- introduce a closed taxonomy;
- hard-block publication on semantic classification;
- alter existing ranking values/order;
- reinterpret QA traffic as real acquisition evidence.

## Closure conditions

CONTENT-5 may close only after:

- exact-head CI passes all historical gates plus the updated UI-2C contract;
- PR merges without drift;
- exact merged main is READY in Production;
- all three Production rankings are published, metric, and OPS-1 ready with zero blockers;
- all 15 entries expose explicit metric scores and null `editor_score`;
- three initial revalidation events exist;
- category/subcategory/ranking/item public routes smoke successfully;
- sitemap includes all three ranking URLs and eligible item URLs;
- recent Production runtime error/fatal and 5xx counts are zero.

## Closure evidence — 2026-08-22

### Production publication

CONTENT-5 published the planned bounded seed as three `metric` rankings and 15 distinct canonical items:

- `top500-supercomputer-hpl-rmax-2026-06-top-5`
- `world-busiest-airports-passengers-2025-top-5`
- `world-largest-cities-population-2025-top-5`

The first fail-closed data transaction aborted because OPS-1 incorrectly interpreted the contiguous proper-name token `TOP500` as an entry-count promise. The transaction rolled back completely, so no partial CONTENT-5 data became public. The parser contract was then corrected from optional whitespace to required whitespace between `TOP`/`탑` and the numeric promise. PR #78 passed CI #324, the hosted migration and direct regex probe passed, and the corrected parser was deployed before publication was retried.

The second fail-closed transaction succeeded atomically. Final Hosted readback confirms:

- each target ranking is `published` and `metric`;
- each ranking has exactly 5 entries and 1 complete criterion;
- `private.ops_1_ranking_editorial_readiness()` returns `editorial_ready=true` and `blockers=[]` for all three;
- each ranking has 2 directly usable public source rows;
- combined CONTENT-5 entries: 15;
- distinct CONTENT-5 item IDs: 15;
- `editor_score IS NULL`: 15/15;
- explicit non-empty `score_json.scores`: 15/15;
- legacy `sponsor_flag=true`: 0/15.

The ACI ranking uses the July 2026 final PVG passenger figure `84,994,548`, not the earlier preliminary `84,994,227` value.

### CONTENT-3 revalidation continuity

All three published rankings have an initial CONTENT-3 `verified_unchanged` revalidation event. Each event contains a two-source snapshot, for 3 revalidation events and 6 snapshotted source records in total.

### Public route and structured-data smoke

Production smoke passed for all three category/subcategory surfaces and ranking details. The ranking details return HTTP 200, `index, follow`, a self-canonical URL, and five-item `ItemList` structured data while retaining their published metric values and authoritative sources.

Representative canonical Item detail smoke also passed:

- `/items/lineshine` renders item type `슈퍼컴퓨터`;
- `/items/hartsfield-jackson-atlanta-international-airport` renders item type `공항`;
- `/items/jakarta` renders item type `도시`.

The Production sitemap contains all 18 newly eligible CONTENT-5 URLs: 3 ranking URLs and 15 item URLs.

### Ranking basis display remediation

Final CONTENT-5 smoke exposed a presentation defect in the pre-existing ranking detail header: non-ISO editorial `scope.period` values were discarded in favor of publication timestamps, the field was labeled `기준일`, and timestamp rendering did not explicitly use the Korea timezone.

PR #79 fixed the display contract without changing ranking data or ordering:

- non-date `scope.period` values are preserved literally;
- an ISO date inside `scope.period` renders in Korean date format;
- timestamp fallback and `최근 업데이트` render with `Asia/Seoul`;
- the public label is `기준` rather than `기준일`;
- regression fixtures cover `PISA 2022`, `2025 정규시즌 최종`, `TOP500 June 2026 (67th edition)`, an ISO period, and the UTC/KST date boundary.

PR #79 exact HEAD `840b60d478c1bb1e0fb6f55a55cd67f97a4e1bbc` passed CI #326 and merged without main drift. The resulting main `6c6e79e3c20e2b5389532e6d103a1e2f21edf09b` deployed as Production `dpl_JAQHfvjxJtv8CmV58QVpMhcAUcmf` and reached `READY`.

Live Production readback on that exact deployment confirms:

- TOP500 basis: `TOP500 June 2026 (67th edition)`;
- ACI basis: `2025년 (2026년 7월 확정)`;
- WUP basis: `2025. 7. 1.`;
- all three render `최근 업데이트` as `2026. 8. 22.` under the Korea timezone.

### Final corpus and runtime readback before closeout merge

Hosted corpus state before the documentation-only closeout PR:

- items: 57 active, 4 archived;
- rankings: 16 published, 1 draft, 1 archived;
- open repository PRs before the closeout PR: 0.

For exact Production deployment `dpl_JAQHfvjxJtv8CmV58QVpMhcAUcmf`, post-deployment route smoke found no runtime error cluster in the recent window and no exact-deployment Production 5xx log entries.

The final documentation-only closeout change introduces no runtime, database, ranking-value, taxonomy, or publication-state mutation. It is eligible to merge only after its own exact-head CI passes and `main` is revalidated for zero drift. After merge, the resulting exact `main` must again reach `READY` in Production before CONTENT-5 is considered operationally closed.
