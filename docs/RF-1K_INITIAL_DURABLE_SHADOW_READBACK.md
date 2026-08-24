# RF-1K — Initial Durable SHADOW Readback

Status: `EXECUTED / DURABLE EVIDENCE PRESENT / PRODUCTION NOT AUTHORIZED`

## Execution provenance

- RF-1J policy bundle: `rf1j-initial-shadow-candidate-v1`
- RF-1K reviewed hypothesis fingerprint: `rf1-52e95b4aa443a342`
- EMPTY profile fingerprint: `rf1-8a3c5da5aad65a7d`
- fixed reference time: `2026-08-24T08:54:00.000Z`
- session fingerprint: `null`
- seed format: `rf1k-initial-shadow:<source-ranking-id>`
- production activation authorized: `false`
- automatic authorization: `FORBIDDEN`

The execution used the existing durable `record_rf1_shadow_run` authority. It did not create recommendation exposure rows and did not change public related-ranking ordering.

## Production corpus readback

At execution time:

- public rankings: **16**
- sources with at least one related candidate: **12**
- sources skipped because candidate count was zero: **4**
- total candidate positions across persisted runs: **18**
- IA-2 protected identity positions: **16**
- contextual non-identity positions: **2**
- sources with any SHADOW position change: **0**
- total changed positions: **0**

The four zero-candidate sources were not persisted because RF-1F requires `candidate_count >= 1`:

- `5416c010-ee96-403b-b9fd-4ba1ddd5d01b`
- `b30ce815-cf50-4006-9391-cbbfb8bb47f6`
- `c694ca9d-0339-4e66-b489-cf36e78b0fff`
- `e973adcf-edbc-4084-89a1-f289eb8ff8b5`

## Durable runs

| Source ranking | Shadow run | Candidates | IA-2 protected | Changed positions |
|---|---|---:|---:|---:|
| `11202f23-40eb-49ff-b5d6-f31c41e5b36e` | `rf1-4ed27c2556c26153` | 2 | 2 | 0 |
| `189bfdfc-9b62-4c78-85b1-bddf2c6a4c92` | `rf1-711e478d4ae3b873` | 2 | 2 | 0 |
| `46c26150-b7a3-49a4-a005-cc05e1e3d59e` | `rf1-9e0037a111ea41a3` | 2 | 2 | 0 |
| `4dbc0b62-0a17-4c63-93a8-73116fbb1ded` | `rf1-e05caa470621d3df` | 1 | 1 | 0 |
| `568d4979-8764-445d-8a2e-399d8c3889a1` | `rf1-2ca1ddf19f9fd29b` | 2 | 2 | 0 |
| `9f383559-c140-4f24-a9a2-b3177adb089a` | `rf1-e13c95d7c11a487f` | 1 | 1 | 0 |
| `a910e1ac-2cae-473b-9ada-3a69b402d612` | `rf1-8cda7921840749b3` | 1 | 1 | 0 |
| `b3cdb443-63d1-49f3-bfae-0c76ff22c9c5` | `rf1-31f4afcb63401fb7` | 2 | 2 | 0 |
| `c82abf5e-cf18-497b-a8ff-83202efc70e2` | `rf1-18021e31168eca7b` | 2 | 2 | 0 |
| `c94d43a5-056a-43f4-ac0d-2225cf42329a` | `rf1-66b34fb666d7295e` | 1 | 0 | 0 |
| `d41fdf88-c970-4982-9638-7a927629d852` | `rf1-3de85bd51a2c9f9b` | 1 | 1 | 0 |
| `f0893910-c8d6-4b73-a1c5-ad7fdc6ffbf1` | `rf1-b79bd73a2d58ea8e` | 1 | 0 | 0 |

## Interpretation

`changed_position_count = 0` is expected structural evidence, not a claim that the policy is already production-quality.

The current production candidate graph does not meaningfully exercise the reranker:

1. **16 of 18 candidate positions are IA-2 protected.** RF-1 is prohibited from moving those positions.
2. The remaining **2 contextual positions each occur as a singleton contextual candidate** for their source. A one-item suffix cannot be reordered.
3. Therefore there is currently no production source with two or more rerankable contextual candidates where RF-1J component scoring can change relative order.

The correct conclusion is that current corpus depth is insufficient to evaluate actual reranking movement. The IA-2 protected prefix must not be loosened merely to manufacture movement evidence.

## Readiness after execution

Hosted readiness after the durable write:

```text
verdict                       = NOT_READY
shadow_order_evidence         = PRESENT_REVIEW_REQUIRED
authenticated_profile_evidence= PRESENT_REVIEW_REQUIRED
related_outcome_evidence      = MISSING
low_exposure_evidence         = MISSING
production_policy_authorized  = false
automatic_authorization       = FORBIDDEN
```

Blockers:

- `NO_RELATED_RANKING_CLICK_OUTCOME_EVIDENCE`
- `NO_USER_VISIBLE_RF1_EXPOSURE_EVIDENCE`

Additional readback:

- `rf1_recommendation_exposures = 0`
- RF-1-attributed product usage rows = `0`
- RF-1I raw related visibility rows = `0`

## Next boundary

Do not tune the numeric policy from this zero-movement corpus result.

The next useful evidence path is to create a controlled/offline candidate-depth evaluation that preserves IA-2 protection but supplies multiple contextual candidates to the RF-1 reranker. This can test relative scoring, diversity, and movement bounds without fabricating organic production outcomes.

Public RF-1 ordering remains **OFF**.
