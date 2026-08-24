# RF-1K — Initial Durable SHADOW Execution Plan

This execution plan is deliberately non-public and non-authorizing.

## Fixed execution inputs

- policy hypothesis: `RF1_REVIEWED_SHADOW_ADMISSION_V1.hypothesis`
- policy bundle: `rf1j-initial-shadow-candidate-v1`
- profile context: unauthenticated server execution, therefore `EMPTY`
- session events: none
- source scope: all currently public production rankings
- persistence scope: only sources with at least one related-ranking candidate
- exposure persistence: none
- public ordering mutation: none

## Determinism

Each source uses a stable seed:

```text
rf1k-initial-shadow:<source-ranking-id>
```

All sources in the same corpus pass use the same fixed reference time. A source with zero candidates is recorded only in the readback report as skipped and is not inserted into `rf1_shadow_runs`, preserving the RF-1F non-empty candidate invariant.

## Readback fields

For each persisted run capture:

- source ranking ID
- candidate count
- protected IA-2 identity count
- baseline ranking IDs
- shadow ranking IDs
- changed position count
- policy hypothesis fingerprint
- profile maturity/fingerprint
- reference time
- deterministic seed

Aggregate readback must report:

- public source count
- sources with candidates
- sources skipped for zero candidates
- durable rows inserted
- total candidate positions observed
- total changed positions
- sources with any position change

## Hard boundary

Durable SHADOW evidence is observational. It does not create RF-1 exposure evidence and does not authorize public activation.
