# IA-2F Recall Recovery Calibration Policy

Status: `CONTROLLED_CALIBRATION`

## Evidence boundary

IA-2E's 260-case holdout is consumed for independent-validation purposes and is reused here only as calibration material.

No IA-2F result may be described as independent validation or organic production evidence.

## Objective

Recover only high-confidence lexical recall lost by the precision-first IA-2C matcher while preserving its abstention behavior.

Target gates:

- reuse Top-1 accuracy >= 80%
- reuse Top-5 recall >= 80%
- selective Top-1 precision >= 95%
- novel Subject suggestion exposure <= 5%
- ambiguous Subject suggestion exposure <= 5%
- exact canonical Top-1 = 100%
- exact reviewed alias Top-1 = 100%
- single-edit typo Top-5 recall >= 95%
- token reorder Top-5 recall >= 80%

## Allowed recovery scope

- exact canonical and reviewed alias behavior
- narrow single-character typo recovery
- exact token cyclic rotation, intended for domain-coordinate movement such as prefix-to-suffix placement

## Explicitly out of scope

IA-2F does not add or infer synonym equivalence such as:

- product/entity synonym dictionaries
- semantic paraphrase rules
- embeddings or vector search
- AI classification
- global ontology
- automatic alias creation
- automatic merge or publication blocking

Surface-semantic variants remain allowed to abstain unless they are recovered by the narrow lexical rules above.

## Next authority

After IA-2F calibration, the matcher must be frozen again. Any generalization claim requires a newly sealed, previously unseen future holdout. IA-2E cannot be reused as independent evidence.

IA-2F writes no organic governance events and does not alter IA-2D readiness.
