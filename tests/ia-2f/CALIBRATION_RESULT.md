# IA-2F Recall Recovery Calibration — Result

Status: `CALIBRATION_TARGET_MET_PENDING_FUTURE_INDEPENDENT_HOLDOUT`

## Authority

- Base main SHA: `a302919bd4292768bce970a66dd6823593a30325`
- PR: `#67`
- Calibration PR head evaluated: `226a4090dc92d2d1038f7b25ba05cd35f82fcd4a`
- GitHub Actions CI run: `#285` / `32453715571`
- Dataset: consumed IA-2E 260-case corpus
- Provenance: `CONTROLLED_SYNTHETIC_CALIBRATION_CONSUMED_IA_2E`
- Independent validation claim: `FORBIDDEN`

## Metrics

| Metric | IA-2E first run | IA-2F calibration |
| --- | ---: | ---: |
| Reuse Top-1 accuracy | 68.0% | 83.33% |
| Reuse Top-5 recall | 68.0% | 83.33% |
| Reuse suggestion coverage | 68.0% | 83.33% |
| Selective Top-1 precision | 100.0% | 100.0% |
| Novel suggestion exposure | 0.0% | 0.0% |
| Ambiguous suggestion exposure | 0.0% | 0.0% |

## Reuse class breakdown

| Case class | IA-2E first run | IA-2F calibration |
| --- | ---: | ---: |
| Exact canonical | 100% | 100% |
| Exact reviewed alias | 100% | 100% |
| Single-edit typo | 92.5% | 100% |
| Token reorder | 5.0% | 100% |
| Semantic surface variant | 13.33% | 16.67% |

## Interpretation

The recovery is intentionally narrow. It restores exact token cyclic rotation and bounded single-character typo handling while preserving abstention for most semantic paraphrases.

The remaining failures are primarily semantic-surface equivalence problems, including vocabulary substitution, added semantic qualifiers, and paraphrases. IA-2F deliberately does not add synonym dictionaries, embeddings, AI classification, or ontology expansion to recover them.

Terminal calibration classification:

`PRECISION_PRESERVED_SAFE_LEXICAL_RECALL_RECOVERED`

## Governance consequence

This result is calibration evidence only. IA-2E is no longer eligible as independent evidence for the modified matcher. The modified matcher must be frozen after IA-2F and evaluated against a newly sealed, previously unseen holdout before any new generalization claim.

No organic governance evidence is written or credited by this calibration.
