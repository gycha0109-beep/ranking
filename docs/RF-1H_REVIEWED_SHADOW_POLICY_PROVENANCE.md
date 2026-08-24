# RF-1H Reviewed SHADOW Policy Provenance

Date: 2026-08-24

## Goal

RF-1H closes a provenance gap before the first durable RF-1 SHADOW run is ever recorded.

RF-1F required a caller-supplied `Rf1PolicyBundle`, but a durable SHADOW row persisted only `policy_bundle_version`. Two different numeric policy bundles could therefore reuse the same version string and become indistinguishable after the fact.

RF-1H makes durable SHADOW evidence depend on an explicitly reviewed, SHADOW-only policy hypothesis and binds each run to a deterministic fingerprint of the actual policy content plus review provenance.

## RF-1G prerequisite finding

RF-1G audited the current RankingWiki production corpus and concluded that the available data can describe calibration gaps but cannot defensibly derive a complete numeric production policy.

Key observed constraints include:

- 16 published/moderation-eligible rankings,
- one observed ranking type (`metric`),
- 18 admitted directed Neighborhood pairs: A=14, B=0, C=4, D=0,
- maximum observed Neighborhood candidate depth of 2,
- 90 total unique views, with 87 on one ranking,
- live ranking likes=0 and bookmarks=0,
- 3 changed SAVE/UNSAVE events across 2 authenticated users,
- 0 generic related-ranking clicks,
- 0 exactly RF-1-attributed related-ranking clicks,
- 0 RF-1 user-visible exposures,
- 0 durable RF-1 SHADOW runs.

Therefore RF-1G always returns:

- `productionPolicyAuthorized = false`
- `automaticPolicyDerivation = FORBIDDEN`
- `productionPolicyBundle = null`

RF-1H does not override that conclusion.

## Reviewed SHADOW-only hypothesis contract

`Rf1ReviewedShadowPolicyHypothesis` requires:

- `reviewStatus = REVIEWED_FOR_SHADOW_ONLY`
- `productionActivationAuthorized = false`
- a non-empty review reference,
- an ISO-compatible review timestamp,
- at least one unique evidence-document reference,
- non-empty rationale for every RF-1 calibration family,
- a complete valid `Rf1PolicyBundle`.

The required rationale families are:

- behavior aggregation,
- profile maturity,
- Neighborhood scoring,
- component scoring,
- freshness,
- popularity,
- low exposure,
- diversity,
- exploration.

The policy hypothesis is fingerprinted under:

`rankingwiki:rf1-shadow-policy-hypothesis:v1`

The fingerprint includes the full validated numeric policy plus review provenance. A numeric policy change therefore changes the hypothesis fingerprint even when `policyBundleVersion` is accidentally or deliberately reused.

## Durable SHADOW evidence binding

`Rf1ShadowEvidenceRecord` now requires `policyHypothesisFingerprint`.

The SHADOW run fingerprint domain is now:

`rankingwiki:rf1-shadow-run:v2`

The run fingerprint includes the policy hypothesis fingerprint in addition to source ranking, policy bundle version, profile/session evidence, reference time, seed, and baseline/shadow ordering.

Changing the reviewed policy hypothesis therefore changes the durable SHADOW run ID.

## Capture boundary

`runAndRecordRf1RelatedShadowEvidence(...)` no longer accepts an unreviewed raw policy bundle for durable evidence capture.

It now:

1. validates `Rf1ReviewedShadowPolicyHypothesis`,
2. executes SHADOW using the exact policy inside the reviewed hypothesis,
3. verifies the SHADOW result reports the same policy bundle version,
4. creates durable evidence with the reviewed hypothesis fingerprint,
5. persists through the service-role SHADOW RPC,
6. rereads readiness.

This still does not authorize public activation.

## Hosted migration

Migration:

`20260824074000_rf_1h_shadow_policy_hypothesis_provenance.sql`

Hosted project:

`RanKing&Radar` (`yjdubukqkcvkymabskzd`)

The migration:

- adds `policy_hypothesis_fingerprint TEXT`,
- fails closed if any pre-existing SHADOW rows exist because historical policy provenance cannot be inferred,
- sets the fingerprint `NOT NULL`,
- requires a non-empty trimmed value,
- indexes fingerprint + reference time,
- replaces `record_rf1_shadow_run(JSONB)` so persistence and idempotent replay equality include the exact hypothesis fingerprint,
- preserves RF-1F non-empty candidate and source-exclusion invariants,
- remains service-role-only.

Production had zero SHADOW rows, so no provenance was backfilled or guessed.

## Verification history

### First RF-1H CI

Head:

`131e35a9c1fa9f8327613336944a2adbe5ce4e6c`

CI run `#449`: `FAILURE`.

RF-1D and RF-1F passed. The failure occurred in `verify:rf-1g` because that verifier still asserted the older RF-1F API shape (`policy: Rf1PolicyBundle`) after RF-1H intentionally replaced it with a stricter reviewed-hypothesis boundary.

This was a verifier contract drift, not a rollback of RF-1G's non-authorizing rule.

### Correction

RF-1G verification was updated to keep its original invariants:

- calibration worksheet cannot create an executable policy,
- cannot rank,
- cannot persist SHADOW evidence,
- cannot persist exposure evidence,

while recognizing the new downstream admission contract:

- reviewed hypothesis contains the complete caller-supplied `Rf1PolicyBundle`,
- durable SHADOW capture accepts `Rf1ReviewedShadowPolicyHypothesis`,
- SHADOW execution receives `reviewedHypothesis.policy` exactly.

### Successful exact-head validation

Head:

`fee9cf89fa4361b8d55e8d9602eddb2109e7e8c5`

CI run `#450`: `SUCCESS`.

Successful gates include:

- RF-1 through RF-1H,
- all existing audit/P1/P2/IA gates,
- OPS/content/UI/launch/acquisition/MEASURE gates,
- lint,
- Next production build.

Verifier policy numbers are fixture-only and were not promoted to a production or hosted policy hypothesis.

## Hosted readback

After migration application:

| Contract | Result |
|---|---:|
| `policy_hypothesis_fingerprint` nullable | `NO` |
| trimmed fingerprint constraint exists | 1 |
| fingerprint/reference-time index exists | 1 |
| durable SHADOW rows | 0 |
| rows with null hypothesis fingerprint | 0 |
| service role can execute `record_rf1_shadow_run` | true |
| authenticated can execute writer | false |
| anon can execute writer | false |

No reviewed hypothesis or SHADOW run was fabricated during readback.

## Readiness after RF-1H

Hosted readiness remains:

`NOT_READY`

- `production_policy_authorized = false`
- `automatic_authorization = FORBIDDEN`

Blockers remain:

- `NO_DURABLE_SHADOW_RUN_EVIDENCE`
- `NO_RELATED_RANKING_CLICK_OUTCOME_EVIDENCE`
- `NO_USER_VISIBLE_RF1_EXPOSURE_EVIDENCE`

Authenticated profile evidence remains `PRESENT_REVIEW_REQUIRED`.

## Current stopping boundary

The implementation now has a governed path for recording a reviewed SHADOW policy hypothesis without confusing it with production authorization.

However, RankingWiki still has **no actual reviewed initial RF-1 policy hypothesis**. RF-1G specifically found that current production evidence cannot derive one automatically.

Therefore the next evidence-producing step requires one of the following external inputs:

1. a human/domain-reviewed SHADOW-only initial policy hypothesis with rationale for every policy family, or
2. additional longitudinal/outcome evidence sufficient to support numeric choices.

Until one of those exists, inserting verifier fixture numbers or synthesizing a policy hypothesis would violate the RF-1 calibration boundary.
