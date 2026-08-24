# RF-1D — Durable SHADOW Evidence & Calibration Readiness

Status: implementation slice on `feat/rf-1-recommendation-transfer`

Depends on:

- RF-1 deterministic recommendation core
- RF-1B related-ranking adapter and real-exposure evidence boundary
- RF-1C authenticated SAVE/UNSAVE profile evidence and SHADOW execution

## 1. Purpose

RF-1D makes SHADOW output durable without pretending that SHADOW output was shown to a user, and adds an evidence-readiness readback that explicitly refuses to authorize a production policy automatically.

The stage separates:

```text
SHADOW order evidence
!= user-visible recommendation exposure
!= outcome evidence
!= production policy authorization
```

## 2. Durable SHADOW evidence

Migration:

`supabase/migrations/20260824064000_rf_1d_shadow_evidence_readiness.sql`

Table:

`public.rf1_shadow_runs`

Each row records:

- deterministic `shadow_run_id`,
- source/current ranking ID,
- policy bundle version,
- profile maturity/fingerprint,
- optional session fingerprint,
- reference time,
- exploration seed,
- exact baseline ranking-ID order,
- exact SHADOW ranking-ID order,
- candidate count,
- changed-position count,
- protected IA-2 prefix count.

It deliberately does not contain:

- `user_id`,
- `viewer_key_hash`,
- clickstream events,
- actual exposure timestamps,
- reward/label fields,
- an authorization flag that can become true.

Raw table access is revoked. The service role writes through `record_rf1_shadow_run(JSONB)`.

## 3. Deterministic SHADOW run identity

`src/lib/recommendation/rf1-shadow-evidence.ts` builds a deterministic ID from material evidence:

```text
source ranking
+ policy bundle version
+ profile maturity/fingerprint
+ session fingerprint
+ reference time
+ seed
+ baseline order
+ SHADOW order
+ candidate count
+ changed-position count
+ protected IA-2 count
```

The fingerprint domain is:

`rankingwiki:rf1-shadow-run:v1`

Identical evidence produces the same `shadowRunId`. Material changes produce a different ID.

## 4. Database-side replay and integrity checks

`record_rf1_shadow_run` independently validates:

- public/moderation eligibility of the source ranking,
- bounded candidate count,
- exact array cardinality,
- no duplicate ranking IDs in either ordering,
- equality of baseline and SHADOW candidate sets,
- changed-position count recomputed from both arrays,
- valid profile maturity,
- non-empty version/fingerprint/seed fields.

Idempotent replay succeeds only when the existing stored row exactly matches the submitted record. A conflicting replay with the same `shadow_run_id` fails closed.

This is evidence storage, not an experimentation or auto-promotion platform.

## 5. Calibration evidence readiness

RPC:

`public.get_rf1_calibration_evidence_summary()`

The function reads current hosted evidence counts for:

- published public rankings,
- changed authenticated bookmark events,
- users represented by those bookmark events,
- MEASURE-1 product-usage events,
- `related_ranking` discovery clicks,
- real RF-1 user-visible exposures,
- durable RF-1 SHADOW runs.

It reports evidence dimensions as:

- `MISSING`, or
- `PRESENT_REVIEW_REQUIRED`.

Possible blockers are explicit evidence gaps:

- `NO_DURABLE_SHADOW_RUN_EVIDENCE`
- `NO_AUTHENTICATED_SAVE_UNSAVE_EVIDENCE`
- `NO_RELATED_RANKING_CLICK_OUTCOME_EVIDENCE`
- `NO_USER_VISIBLE_RF1_EXPOSURE_EVIDENCE`

RF-1D does **not** introduce a numerical minimum-sample threshold. The repository does not currently contain enough RankingWiki-specific evidence to justify such a threshold.

Even if all four evidence dimensions later become present, the function returns:

`EVIDENCE_PRESENT_REVIEW_REQUIRED`

rather than an automatic approval.

The following fields are invariant:

```text
production_policy_authorized = false
automatic_authorization = FORBIDDEN
```

## 6. Hosted evidence observed before RF-1D

Observed on 2026-08-24 from the connected RankingWiki Supabase project (`RanKing&Radar`) after RF-1B/RF-1C migration application and before any RF-1D SHADOW record was written:

| Evidence | Observed count |
|---|---:|
| public/moderation-eligible published rankings | 16 |
| ranking entries | 86 |
| changed bookmark events | 3 |
| users represented by changed bookmark events | 2 |
| active likes | 0 |
| ranking unique-view total rows | 1 |
| total ranking unique views | 1 |
| MEASURE-1 product-usage events | 23 |
| related-ranking discovery clicks | 0 |
| semantic projections | 16 |
| RF-1 real exposure rows | 0 |
| RF-1 durable SHADOW rows | 0, by construction before RF-1D |

Interpretation:

- authenticated SAVE/UNSAVE evidence exists, but is sparse,
- related-ranking outcome evidence is absent,
- user-visible RF-1 exposure evidence is absent because RF-1 has not been activated,
- no durable SHADOW evidence existed before RF-1D,
- therefore RankingWiki-specific production weights/half-lives/caps/slots cannot be justified from current evidence.

These counts are an observed hosted snapshot, not a benchmark threshold and not training data authorization.

## 7. Hosted RF-1B/RF-1C readback

RF-1B and RF-1C migrations were applied successfully to the hosted RankingWiki project before RF-1D.

Observed RF-1B boundary:

- `rf1_recommendation_exposures` exists,
- RLS is enabled,
- raw SELECT is unavailable to anon/authenticated/service-role roles,
- service role can execute the governed exposure write and candidate-signal read RPCs,
- authenticated users cannot execute the exposure write RPC,
- exposure row count remained `0`,
- candidate-signal readback returned existing item IDs and engagement counts without fabricating exposure values.

Observed RF-1C boundary:

- authenticated users can execute `get_rf1_my_profile_events`,
- anon cannot execute it,
- the RPC remains constrained by `auth.uid()` and current public-content checks.

No synthetic production exposure was inserted for verification.

## 8. Supabase advisor interpretation

After RF-1B/RF-1C hosted application:

### RF-1 exposure table

Supabase reports `RLS Enabled No Policy` as INFO for `rf1_recommendation_exposures`.

This is intentional. The table is a deny-all raw evidence store and access is through service-role-only RPCs. A permissive RLS policy would weaken the intended boundary.

The RF-1 run index may also appear as unused while the table contains zero rows. That is expected before real exposure traffic exists.

### Authenticated profile RPC

Supabase reports that `get_rf1_my_profile_events` is an authenticated-callable `SECURITY DEFINER` function.

That executability is intentional for this RPC. The function:

- derives identity from `auth.uid()`,
- returns only that user’s changed bookmark transitions,
- applies current public-content eligibility,
- grants execution to `authenticated` and not `anon`,
- does not expose raw bookmark-event table access.

This warning is therefore reviewed as an intentional authenticated self-data RPC boundary, not ignored as a generic false positive.

## 9. SHADOW versus exposure

RF-1D never writes SHADOW evidence into `rf1_recommendation_exposures`.

A SHADOW ordering was not shown to the user and must not affect:

- recent exposure counts,
- low-exposure correction,
- user outcome attribution,
- production recommendation metrics.

`rf1_shadow_runs` and `rf1_recommendation_exposures` remain separate authorities.

## 10. No policy calibration yet

RF-1D does not define production values for:

- event weights,
- event half-lives,
- maturity thresholds,
- score component weights,
- freshness half-life,
- popularity coefficients,
- low-exposure threshold/boost,
- diversity window/caps,
- exploration slots/gates.

The current hosted evidence is insufficient to distinguish good RankingWiki-specific values from arbitrary choices.

Synthetic verifier fixtures remain tests of invariants only. Journey values remain reference architecture only.

## 11. Verification

`npm run verify:rf-1d` covers:

- explicit source-ranking binding,
- deterministic SHADOW run identity,
- material-input sensitivity,
- duplicate-ID rejection,
- candidate-set preservation,
- changed-position recomputation,
- service-role-only write/readback boundary,
- durable baseline and SHADOW order storage,
- conflicting replay rejection,
- no new user/viewer identity,
- no invented numerical sample threshold,
- explicit NOT_READY blockers,
- permanent automatic-authorization prohibition,
- public ranking page remains disconnected from RF-1 SHADOW execution and persistence.

CI executes RF-1D after RF-1/RF-1B/RF-1C and before lint/build.

## 12. Activation state after RF-1D

```text
RF-1 core implemented                 YES
RF-1B adapter/persistence implemented YES
RF-1C real profile read implemented   YES
RF-1C SHADOW runner implemented       YES
RF-1D SHADOW evidence implemented     YES
hosted RF-1B/RF-1C schema applied     YES
production policy calibrated          NO
public reranking activated            NO
real RF-1 exposure generated          NO
production recommendation verified    NO
```

## 13. Next safe work

The next safe boundary is instrumentation/evidence acquisition, not policy guessing.

Required before user-visible activation:

1. define and implement raw `FEED_IMPRESSION` / `RELATED_OPEN` outcome attribution for the related-ranking surface,
2. define `QUICK_SKIP` and `DWELL` raw telemetry semantics before mapping them into normalized magnitude,
3. preserve anonymous/session identity separation,
4. execute SHADOW with explicitly labeled calibration policies rather than production policies,
5. accumulate durable SHADOW and real baseline-navigation outcome evidence,
6. compare policy variants offline/SHADOW with provenance,
7. require explicit human review before any candidate policy becomes production-authorized.

RF-1D itself grants no authorization to proceed to user-visible reranking.
