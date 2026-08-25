# CONTENT-CORPUS-200 — Materialization Wave 1

## Status

`SOURCE_EVIDENCE_PARTIALLY_MATERIALIZED`

This stage materializes source evidence for the first 50 rankings from the frozen `content-corpus-200-manifest-v1` without authorizing production publication, recommendation evaluation, taxonomy mutation, or editorial scoring.

Frozen manifest SHA-256:

`f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493`

Frozen Wave 1 SHA-256:

`7e0c2b11cf9f6f5b4468d3ab112a2fa31d5ace2a55ef4bca0713771647562f6c`

Evidence observation time:

`2026-08-25T12:44:00+09:00`

## Scope

Wave 1 covers five frozen content families:

1. `steam-mainstream`
2. `korean-box-office`
3. `netflix-titles`
4. `smartphones`
5. `kbo-clubs`

Each family maps exactly ten manifest rankings: 3 FACT + 5 EDITORIAL_COMPOSITE + 2 COMMUNITY_VOTE.

## Materialization result

| State | Count |
| --- | ---: |
| Selected rankings | 50 |
| FACT | 15 |
| FACT materialized from reviewed source evidence | 11 |
| FACT explicitly blocked by source gap | 4 |
| EDITORIAL_COMPOSITE | 25 |
| Editorial weights assigned | 0 |
| COMMUNITY_VOTE | 10 |
| Fabricated vote rows | 0 |
| Production rows written | 0 |
| Recommendation runs | 0 |

## Explicit source gaps

The following FACT rankings remain blocked rather than receiving substituted or inferred data:

- `cc200-steam-mainstream-02` — official weekly Steam route exists, but the current retrieval surface did not expose title labels reliably enough to freeze the ranking.
- `cc200-steam-mainstream-03` — a reviewed 2026 new-release all-time peak source set has not been completed.
- `cc200-netflix-titles-03` — a comparable title-level global Top 10 history set has not been frozen.
- `cc200-kbo-clubs-03` — the reviewed KBO team pitching table exposes whole-team ERA, not bullpen-only ERA. Whole-team ERA must not be substituted.

## Editorial boundary

Wave 1 freezes only source-backed candidate universes for the 25 editorial rankings. It does not assign evidence scores, dimension weights, composite formulas, or final editorial ordering.

`CANDIDATES_FROZEN_SCORING_UNASSIGNED`

The candidate universes are eligibility pools, not editorial verdicts.

## Community vote boundary

Wave 1 freezes candidate universes for ten native RankingWiki vote rankings but creates no vote counts or outcomes.

`CANDIDATES_FROZEN_NO_VOTES`

The eventual ordering authority remains real `ranking_votes` data.

## Authority boundary

This stage does **not** authorize any of the following:

- production database writes
- public publication
- taxonomy mutation
- RF-1 recommendation evaluation
- public RF-1 ordering
- editorial scoring or weight assignment

The source evidence file is an offline reviewed artifact only. `src/app/rankings/[rankingSlug]/page.tsx` must not import or consume it.

## Next boundary

After this Wave is merged, later work may independently:

1. materialize another frozen batch of manifest families;
2. close individual source gaps using reviewed source evidence; or
3. design a separate reviewed editorial-scoring protocol.

None of those follow automatically from Wave 1 and none changes the production activation authority.
