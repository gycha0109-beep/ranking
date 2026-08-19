# CONTENT-4 Production Coverage Expansion / Editorial Operating Cycle

Status: **SUCCESS / CLOSED**

## Objective

CONTENT-4 validates that the existing OPS-1 editorial quality contract, `metric` ranking model, and CONTENT-3 recurring revalidation workflow remain practical when Production coverage expands into source shapes and update cadences that differ from the first two content batches.

The stage intentionally avoids adding schema, RPC, crawler, or application behavior unless the operating evidence requires it.

## Starting authority

CONTENT-4 started from authoritative main:

- `aa93e323c2572a9e435f11e3fe5106ea4f7b9747`
- published rankings: `8`
- active items: `26`
- visible top-level categories: `4`

The existing corpus covered World Bank/국가데이터처 statistics, KBO official records, and UNESCO World Heritage data.

## Production batch

CONTENT-4 adds five source-backed `metric` rankings.

### Education / OECD PISA

1. `PISA 2022 수학 평균점수 TOP 5`
   - slug: `pisa-2022-mathematics-top-5`
2. `PISA 2022 읽기 평균점수 TOP 5`
   - slug: `pisa-2022-reading-top-5`
3. `PISA 2022 과학 평균점수 TOP 5`
   - slug: `pisa-2022-science-top-5`

Authority:

- OECD PISA 2022 Results Volume I
- OECD PISA 2022 Database / Education GPS

New taxonomy:

- top-level `교육` / `education`
- subcategory `PISA` / `pisa`

### Sports / FIFA

4. `2026년 7월 FIFA 남자 세계랭킹 TOP 5`
   - slug: `fifa-men-world-ranking-2026-07-top-5`
   - official snapshot: 2026-07-20
5. `2026년 6월 FIFA 여자 세계랭킹 TOP 5`
   - slug: `fifa-women-world-ranking-2026-06-top-5`
   - official snapshot: 2026-06-16

Authority:

- FIFA/Coca-Cola official men/women world ranking pages
- corresponding FIFA official ranking-update reports

New taxonomy:

- existing top-level `스포츠` / `sports`
- new subcategory `FIFA` / `fifa`

## Canonical entity modeling

CONTENT-4 preserved entity semantics instead of reusing superficially similar items.

### PISA entities

- normal countries use `country` items;
- `Macao (China)`, `Hong Kong (China)`, and `Chinese Taipei` use `economy` items because PISA treats them as separately reported education systems/economies;
- existing `japan` country entity is reused where its meaning is identical.

### FIFA entities

A country and its national football team are not the same canonical entity.

Therefore FIFA rankings do not reuse generic country items. Separate gender-specific `sports_team` entities were created for the national teams in the published top five lists.

This prevents country-level statistics and national-team sports results from collapsing into one ambiguous item identity.

## Authoring transaction

The entire batch was written with a fail-closed transaction:

1. assert planned ranking/item/taxonomy slugs do not already exist;
2. create taxonomy and canonical entities;
3. create all five rankings as draft;
4. create criteria, public sources, entries, reasons, and explicit metric values;
5. evaluate every ranking with `private.ops_1_ranking_editorial_readiness()`;
6. abort the whole transaction if any ranking is not ready;
7. publish all five only after all five pass;
8. create the initial CONTENT-3 revalidation event for every newly published ranking.

The transaction completed successfully without a partial-write remediation cycle.

## Editorial quality acceptance

Hosted readback after publication showed:

- new rankings published: `5 / 5`
- entry count per ranking: `5`
- new entries: `25`
- all five `editorial_ready=true`
- blockers: `0`
- published rankings failing readiness globally: `0`
- legacy published `sponsor_flag=true`: `0`
- rating-style `editor_score` on published entries: `0`
- CONTENT-4 item moderation/status anomalies: `0`

All entry metric values are represented through explicit `score_json.scores` values.

## Revalidation cadence

CONTENT-4 also proves that the same CONTENT-3 workflow can accommodate different source volatility.

### PISA

PISA 2022 is a historical released dataset. The three rankings received a low-frequency initial review cadence of approximately 180 days.

### FIFA

FIFA rankings are current snapshots with scheduled future ranking releases.

- men: next review scheduled immediately after the next official update window, 2026-10-08 KST;
- women: next review scheduled immediately after the next official update window, 2026-10-21 KST.

Each new ranking has exactly one initial `verified_unchanged` revalidation event and a two-source immutable source snapshot.

## Production acceptance

Public Production acceptance confirmed:

- `/categories/education/pisa` returns 200 and lists all three PISA rankings;
- `/categories/sports/fifa` returns 200 and lists both FIFA rankings;
- all five ranking details return 200;
- ranking detail renders `공식 지표`, explicit values, methodology, scope, public sources, related rankings, canonical metadata, and ItemList JSON-LD;
- PISA reading preserves tie semantics rather than claiming a false statistical ordering;
- FIFA detail uses national-team item routes rather than generic country entities;
- search for `PISA` returns the three PISA rankings as the leading ranking matches;
- search for `FIFA` returns exactly the two FIFA rankings;
- recent Production runtime error clusters: `0`.

## Final Production corpus

At CONTENT-4 closeout:

- visible top-level categories: `5`
- visible subcategories: `6`
- published rankings: `13`
- active items: `42`
- published rankings failing OPS-1 readiness: `0`

## Repeatability finding

CONTENT-4 did not require:

- a new DB schema;
- a new RPC;
- a new public/admin application feature;
- a crawler/import subsystem.

The existing authoring/revalidation contracts handled five additional rankings across two new source/update patterns.

The main manual complexity observed was semantic normalization: deciding whether an external source row represents a country, an economy/education system, or a national sports team. That is an editorial/entity-modeling problem, not evidence that a general crawler is currently required.

Therefore P2-4 external ingestion remains **deferred**.

## Product usage signal

The application already stores content views, likes, bookmarks, and comments, but there is no structured search-query telemetry table.

At CONTENT-4 closeout the existing stored engagement signal is not a reliable post-expansion usage baseline:

- unique-view total stored: `169`;
- the view rows were recorded on 2026-08-17 to 2026-08-18;
- `149` of those views belong to the old `best-chicken-breast` QA target;
- the remainder are almost entirely its two old item targets;
- current likes: `1`;
- current bookmarks: `1`;
- current comments: `2`.

Those signals predate the current 13-ranking corpus and are dominated by prior QA activity. They must not be treated as evidence of real user demand or discovery quality.

## Next stage decision

After CONTENT-4, another blind coverage batch would produce less information than measuring whether users can actually discover and use the current corpus.

The recommended next stage is:

**MEASURE-1 — Product Usage & Discovery Baseline / Real-User Validation Readiness**

MEASURE-1 should first audit the existing telemetry contract, distinguish QA/internal traffic from meaningful user activity where possible, identify missing discovery signals such as search-query/result interaction telemetry, and define a minimal measurement baseline before changing search ranking or adding more content infrastructure.

P2-4 should be reconsidered only when repeated editorial operation provides concrete evidence that source acquisition, normalization, update frequency, or provenance handling is a material bottleneck.
