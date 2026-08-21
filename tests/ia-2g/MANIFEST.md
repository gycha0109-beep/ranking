# IA-2G Independent Holdout v2 — Sealed Manifest

Status: `SEALED`

## Authority

- Frozen matcher/main SHA: `5d8a3c9fd2b32591c965338ad0e6a2acbd0bc4d9`
- Benchmark ID: `ia-2g-independent-holdout-v2`
- Provenance: `CONTROLLED_SYNTHETIC_INDEPENDENT_HOLDOUT`
- First-run performance gate: `NONE_RECORD_OBSERVED_RESULT`

## Fixture integrity

SHA-256 values are computed over the exact UTF-8 file bytes, including the trailing newline.

| File | Expected SHA-256 |
| --- | --- |
| `options.json` | `4dd8e2c631d72802bf77118c4bd38a67dc52f726bab633ce4331b5699437e3ba` |
| `reuse.json` | `c06ae0a9663176ce4afba540087c823d3a06c647197fa3517e0b707f1145cd71` |
| `new.json` | `810fa155f81d9ea2616408313ffa03c5f7609eabe0d2e1ac45ae6b7c9ba3a6f1` |
| `abstain.json` | `99a676961a337bed9e60b06246b7e9c7018993931d943627fe7a9a6acdb8ccdf` |

## Expected counts

- Subject options: 50
- Reuse cases: 200
- Novel cases: 100
- Ambiguous / abstention cases: 25
- Total decisions: 325

Reuse class counts:

- `exact_canonical`: 50
- `exact_reviewed_alias`: 25
- `single_edit_typo`: 50
- `token_reorder`: 25
- `semantic_surface_variant`: 50

## Governance

The fixture corpus is frozen before verifier wiring and first execution. IA-2G must not modify `src/lib/ranking-subject-suggestions.ts`. The first authorized run is observational only; no metric may fail the first run. After observation, the result is recorded immutably and the corpus is considered consumed for independent-validation purposes.
