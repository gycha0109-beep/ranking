# RF-1C — Authenticated Profile Evidence & SHADOW Execution

Status: implementation slice on `feat/rf-1-recommendation-transfer`

Depends on:

- RF-1 deterministic recommendation core
- RF-1B related-ranking adapter and exposure evidence boundary

## 1. Purpose

RF-1C establishes the first real long-term behavior evidence source and an execution path that can calculate RF-1 ordering without changing what users see.

The stage intentionally separates three concepts:

1. authenticated long-term profile evidence,
2. ephemeral session evidence,
3. SHADOW ranking output.

It does **not** activate personalized ordering on the public ranking page.

## 2. Long-term profile authority

The current repository has multiple behavior-like sources, but they do not have equivalent identity semantics.

| Source | Identity | RF-1C decision |
|---|---|---|
| `content_bookmark_events` | authenticated `user_id` | use actual changed SAVE/UNSAVE transitions |
| `content_like_events` | authenticated `user_id` | do not use; LIKE is not in approved RF-1 behavior vocabulary |
| `content_daily_views` | privacy-preserving viewer hash | do not promote to authenticated long-term profile |
| `product_usage_events` / MEASURE-1 | privacy-preserving viewer hash | do not promote to authenticated long-term profile |

RF-1C therefore treats changed bookmark transitions as the only currently governed long-term profile evidence.

The approved mapping is exact:

```text
requested_bookmarked = true  + changed = true → SAVE
requested_bookmarked = false + changed = true → UNSAVE
```

No LIKE event is invented.

## 3. Profile read contract

Migration:

`supabase/migrations/20260824062000_rf_1c_profile_evidence_read.sql`

RPC:

`public.get_rf1_my_profile_events(p_since, p_limit)`

Properties:

- requires `auth.uid()`,
- callable by `authenticated` only,
- reads existing `content_bookmark_events`,
- uses only `changed = TRUE`,
- filters to the requested lookback window,
- selects the **most recent bounded N events** first,
- then returns those selected events in ascending time / event-ID order for deterministic aggregation,
- limits to at most 1000 rows,
- resolves ranking features only when the ranking is currently public/moderation-eligible,
- resolves item events only when `private.is_public_item` is true.

This means profile feature projection uses current governed content metadata at read time. RF-1C does not pretend to have historical category/subcategory snapshots that the repository never stored.

## 4. Feature attribution

`src/lib/recommendation/rf1-profile-adapter.ts`

For a ranking SAVE/UNSAVE, the adapter may emit:

- `category:<category_id>`
- `subcategory:<subcategory_id>` when present
- `rankingType:<ranking_type>`
- `item:<item_id>` for currently public entries in that ranking

For an item SAVE/UNSAVE, the adapter emits only:

- `item:<item_id>`

Feature lists are deduplicated and deterministically sorted.

Each converted event uses normalized `magnitude = 1`. Time decay and signed value remain the responsibility of the supplied RF-1 policy bundle.

## 5. Attribution boundary

Existing bookmark events were not historically written with `recommendation_run_id` or `exposure_id`.

RF-1C therefore emits:

```text
recommendationRunId = null
exposureId = null
```

It does not guess whether an old SAVE/UNSAVE came from a recommendation.

Outcome attribution is a later instrumentation stage.

## 6. Anonymous behavior

Anonymous users have no authenticated bookmark profile authority.

`loadOptionalMyRf1ProfileEvents` therefore resolves an anonymous/no-session request to an empty event list. The RF-1 core then produces an `EMPTY` cold-start profile.

RF-1C does not link MEASURE-1 viewer hashes to authenticated users.

## 7. Session behavior

Session behavior remains ephemeral in RF-1C.

`runRf1RelatedShadow` accepts optional in-memory `sessionEvents` supplied by its caller. If no session events are supplied, session interest is `null`.

RF-1C does not create:

- a durable session identifier,
- a session-event table,
- cookie-to-profile linkage,
- cross-session anonymous identity.

This avoids silently creating a new identity authority before UI instrumentation semantics are defined.

## 8. SHADOW execution

`src/lib/recommendation/rf1-shadow.ts`

Execution flow:

```text
existing getRelatedRankings
→ authenticated SAVE/UNSAVE profile read or EMPTY
→ optional ephemeral session events
→ RF-1B candidate signal hydration
→ IA-2 protected-prefix planning
→ contextual suffix → RF-1 scoring/diversity/exploration
→ protected prefix + reranked contextual suffix merge
→ compare baseline order vs SHADOW order
→ return SHADOW evidence only
```

The returned evidence includes:

- `mode = SHADOW`
- baseline ranking IDs
- shadow ranking IDs
- changed-position count
- protected IA-2 count
- profile maturity
- profile fingerprint
- optional session fingerprint
- policy bundle version
- reference time
- seed

## 9. No exposure fabrication in SHADOW

RF-1B introduced a real-exposure persistence contract. RF-1C SHADOW deliberately does **not** call it.

A SHADOW result was never presented to the user, therefore it is not an exposure.

RF-1C does not call:

- `createRf1RelatedExposureRecords`
- `recordRf1RelatedExposureRecords`

If SHADOW evidence needs durable storage later, it requires a separate shadow-run evidence contract rather than misusing actual exposure rows.

## 10. Policy boundary

RF-1C still ships no RankingWiki production policy bundle.

The SHADOW runner requires the caller to supply a fully versioned `Rf1PolicyBundle`.

It derives:

- profile lookback from `behavior.lookbackMs`,
- profile read bound from `behavior.maximumEvents`,
- low-exposure read window from `score.lowExposureWindowMs`.

Caller-requested profile limits are clamped to both the policy event maximum and the DB safety bound.

No Journey values and no test fixture values become production defaults.

## 11. Public runtime boundary

The current public ranking page does not import or invoke `runRf1RelatedShadow`.

Therefore RF-1C changes neither:

- rendered Related Rankings order,
- UI copy,
- route behavior,
- exposure writes,
- production recommendation policy.

The stage creates an executable server-side SHADOW path but leaves activation to an explicit later stage.

## 12. Verification

`npm run verify:rf-1c` checks:

- authenticated-only profile RPC,
- changed bookmark transitions only,
- exact SAVE/UNSAVE mapping,
- no LIKE promotion,
- no MEASURE-1/viewer-hash promotion,
- current public/moderation feature projection,
- deterministic governed feature attribution,
- null recommendation/exposure attribution where absent,
- anonymous cold-start behavior,
- in-memory session-only semantics,
- explicit SHADOW mode,
- existing candidate authority reuse,
- IA-2 protected-prefix merge,
- baseline/shadow comparison evidence,
- no actual exposure persistence from SHADOW,
- no hard-coded production policy,
- no public ranking-page activation.

## 13. Remaining work

RF-1C does not close:

1. RankingWiki-specific policy calibration,
2. raw FEED_IMPRESSION / QUICK_SKIP / DWELL instrumentation,
3. session identity if durable session behavior becomes necessary,
4. outcome attribution to recommendation exposure IDs,
5. durable SHADOW run evidence,
6. hosted migration application/readback,
7. repeated SHADOW replay against real traffic/content,
8. user-visible reranking,
9. production rollout controls.

The next safe stage is RF-1D: calibration/evidence harness and durable SHADOW-run provenance. It should produce evidence for choosing RankingWiki policy values without treating synthetic fixtures or Journey constants as production authorization.
