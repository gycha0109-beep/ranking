# RF-1B — Persistence & Related-Ranking Adapter Boundary

Status: implementation slice on `feat/rf-1-recommendation-transfer`

Depends on: RF-1 core (`src/lib/recommendation/rf1-core.ts`)

## 1. Purpose

RF-1B closes the first persistence and runtime-adapter boundary without activating personalization in production.

It does four things:

1. preserves existing IA-2 identity-first candidate authority,
2. adapts only contextual Neighborhood candidates into RF-1 scoring input,
3. reuses existing RankingWiki engagement authorities for popularity signals,
4. persists recommendation exposure provenance without creating a second user analytics identity system.

It does not change the public Ranking Neighborhood retrieval order or the current UI.

## 2. IA-2 identity boundary

`getRelatedRankings` may return candidates admitted by either:

- IA-2 identity relation (`same_version`, `same_view`, `same_claim`, `same_subject`), or
- contextual Ranking Neighborhood A/B/C/D evidence.

The RF-1 core accepts contextual A/B/C/D Neighborhood evidence. Mapping an IA-2 identity relation into an A/B/C/D tier would fabricate a cross-authority score mapping that does not exist in the repository.

RF-1B therefore uses a protected-prefix contract:

```text
getRelatedRankings source order
        ↓
IA-2 identity prefix ────────────────┐
        ↓                            │ unchanged
contextual Neighborhood suffix       │
        ↓                            │
RF-1 scoring/diversity/exploration   │
        ↓                            │
contextual suffix rerank             │
        └────────────────────────────┘
        ↓
final related-ranking order
```

Rules:

- IA-2 rows remain in their original relative order.
- IA-2 rows are not assigned fabricated RF-1 component scores.
- Once a non-identity contextual row begins, a later IA-2 row is rejected as an authority-order invariant violation.
- Every non-IA2 row must have contextual A/B/C/D Neighborhood evidence.
- RF-1 may reorder only the contextual suffix.

This preserves existing identity-first semantics while still allowing personalization where the current RF-1 evidence model is valid.

## 3. Candidate signal hydration

`public.get_rf1_candidate_signals(UUID[], TIMESTAMPTZ)` is a service-role-only read adapter.

It reuses existing authorities:

| Signal | Existing authority |
|---|---|
| item IDs | public eligible `ranking_entries` + `items` |
| unique views | `content_view_totals` |
| likes | `content_likes` |
| bookmarks | `content_bookmarks` |
| recent RF-1 exposure | `rf1_recommendation_exposures` |

It does not write analytics data and does not copy MEASURE-1 viewer identity.

The server adapter recomputes contextual Neighborhood evidence with the existing `classifyRankingNeighbor` implementation. No new Jaccard threshold or Neighborhood tier is introduced.

Missing hydration for a source candidate fails closed rather than silently substituting zero. A returned row may legitimately contain zero counts, but the row itself must exist.

## 4. Exposure evidence store

Migration:

`supabase/migrations/20260824060000_rf_1b_recommendation_exposure_evidence.sql`

Table:

`public.rf1_recommendation_exposures`

This table is recommendation provenance, not general product analytics.

It deliberately contains no:

- `user_id`,
- `viewer_key_hash`,
- query text,
- search telemetry,
- clickstream event vocabulary.

Stored evidence includes:

- deterministic exposure ID,
- recommendation run ID,
- surface (`related_rankings` only in RF-1B),
- ranking ID,
- ranking mode (`IA2_PROTECTED` or `RF1_RERANKED`),
- IA-2 identity relation when protected,
- source rank,
- final rank,
- policy bundle version,
- profile version/fingerprint,
- optional session fingerprint,
- RF-1 component score breakdown when reranked,
- exploration flag,
- diversity relaxation dimensions,
- exposure timestamp.

Raw table access is revoked. Writes and signal reads are exposed only through service-role RPCs.

## 5. Atomic exposure write

`public.record_rf1_recommendation_exposures(JSONB)` accepts one bounded batch and executes inside one database function transaction.

The write path validates:

- array/object shape,
- public ranking eligibility,
- surface,
- rank positivity,
- mode/identity shape,
- score-breakdown presence for RF-1 rows,
- absence of fabricated score breakdown for IA-2 protected rows,
- approved diversity dimensions,
- policy/profile provenance.

Idempotent replay is allowed only when the existing exposure row exactly matches the replayed payload. A conflicting replay fails closed.

The `(recommendation_run_id, ranking_id)` uniqueness constraint prevents a run from emitting multiple exposure identities for the same ranking.

## 6. Identity decision

RF-1B intentionally does not persist a long-term user profile.

Current repository identity authorities differ:

- bookmark/like state and events use authenticated `user_id`,
- daily unique views and MEASURE-1 use privacy-preserving viewer hashes,
- RF-1 session behavior has not yet been given a production session-identity contract.

RF-1B avoids choosing one of these as a universal recommendation identity.

Exposure evidence stores profile/session fingerprints only as provenance supplied by the recommendation run. It does not create a new durable user identifier.

## 7. Adapter API

`src/lib/recommendation/rf1-related-adapter.ts`

Pure deterministic functions:

- `planRf1RelatedCandidates`
- `toRf1FeedCandidates`
- `mergeRf1RelatedRankingResult`
- `createRf1RelatedExposureRecords`

`src/lib/recommendation/rf1-related-server.ts`

Server-only integration functions:

- `loadRf1RelatedCandidateEvidence`
- `recordRf1RelatedExposureRecords`

The split keeps policy/ranking logic independently testable and confines Supabase service-role access to the server integration layer.

## 8. Runtime sequence intended for a later activation stage

```text
getPublishedRankingBySlug
→ getRelatedRankings                 existing authority
→ loadRf1RelatedCandidateEvidence    RF-1B hydration
→ planRf1RelatedCandidates           protect IA-2 prefix
→ toRf1FeedCandidates                contextual suffix only
→ rankRf1Feed                        RF-1 core
→ mergeRf1RelatedRankingResult       restore protected prefix
→ render candidate order             NOT wired in RF-1B
→ createRf1RelatedExposureRecords
→ recordRf1RelatedExposureRecords    NOT wired to public page in RF-1B
```

RF-1B supplies the path but does not invoke it from the public ranking page yet.

## 9. Why runtime activation remains deferred

A production policy bundle is still intentionally absent. RF-1 has no calibrated RankingWiki-specific values for:

- behavior event weights,
- half-lives,
- maturity thresholds,
- component weights,
- freshness decay,
- low-exposure threshold/boost,
- diversity window/caps,
- exploration slots/gates.

Activating the adapter with fixture or Journey values would violate the transfer-design requirement.

In addition, long-term user behavior still lacks a reconciled identity/read contract.

## 10. Verification

`npm run verify:rf-1b` checks:

- IA-2 prefix protection,
- no IA-2 → A/B/C/D fabricated mapping,
- contextual suffix completeness,
- source-rank preservation,
- deterministic merge shape,
- scoreless IA-2 provenance,
- RF-1 score/exploration/diversity provenance,
- profile/session fingerprint binding,
- existing `getRelatedRankings` and IA-2 ordering presence,
- existing A/B/C/D Neighborhood contract presence,
- existing views/likes/bookmarks reuse,
- no `user_id` or viewer hash in the RF-1 exposure store,
- service-role-only RPC access,
- public/moderation gates,
- conflicting replay rejection.

CI runs RF-1B before lint and production build.

## 11. Remaining work

RF-1B does not claim the following are closed:

1. authenticated long-term profile read adapter,
2. anonymous/session behavior identity,
3. production FEED_IMPRESSION / QUICK_SKIP / DWELL instrumentation,
4. outcome attribution from later SAVE/UNSAVE or other behavior back to an exposure,
5. RankingWiki-specific policy calibration,
6. SHADOW comparison against the current related-ranking order,
7. public ranking page integration,
8. hosted migration application/readback,
9. production deployment verification.

The next safe stage is RF-1C: establish profile/session behavior evidence semantics and a SHADOW-only execution path before any user-visible reranking.
