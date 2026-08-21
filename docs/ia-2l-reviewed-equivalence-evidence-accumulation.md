# IA-2L — Reviewed Equivalence Evidence Accumulation

Status: implementation / verification stage

Starting authority:

- main: `519f16bcbf760153679b267838714e0f2658d94a`
- IA-2K verdict: `NO_SAFE_AUTOMATIC_INDEPENDENT_ANCHOR_FOUND`
- IA-2H operational fallback: `QUARANTINED`
- existing reviewed Alias authority: active, optional, non-blocking

## 1. Purpose

IA-2L does not invent a new automatic Subject matcher.

Its purpose is to turn the already-existing IA-2D append-only semantic governance event stream into a bounded, reviewable evidence set for future semantic-equivalence work.

The evidence authority remains:

`public.ranking_semantic_governance_events`

MEASURE-1 `product_usage_events` is not reused.

No new evidence table, event type, database migration, ontology, embedding/vector system, LLM classifier, automatic merge/remap, or publication block is introduced.

## 2. Evidence interpretation ceiling

The IA-2D `suggestion_keys` field is generated at finalized save time by the server-side deterministic Subject suggestion algorithm.

Therefore IA-2L freezes the interpretation as:

`CANDIDATE_AVAILABLE_AT_FINAL_SAVE_NOT_CONFIRMED_UI_EXPOSURE`

This is deliberately weaker than `SUGGESTION_SHOWN`.

IA-2L MUST NOT claim that the operator necessarily saw, read, or consciously evaluated every key in `suggestion_keys`.

## 3. Decision labels

IA-2L derives decision-level labels only from finalized governance events.

### POSITIVE_REUSE

A `subject_decision_saved` event where:

- `suggestion_keys` is non-empty, and
- `resolution_kind = 'suggestion'`.

Meaning:

The finalized save explicitly selected one deterministic canonical Subject candidate.

This is positive reuse evidence for the finalized operator decision. It is not universal ontology truth.

### NEGATIVE_NEW_SUBJECT

A `subject_decision_saved` event where:

- `suggestion_keys` is non-empty, and
- `resolution_kind = 'new'`.

Meaning:

A deterministic reuse candidate was available at final save, but the finalized decision created/kept a new Subject instead.

This is decision-level negative evidence. It MUST NOT be promoted into a global `DIFFERENT_CONCEPT` assertion for every candidate key without further review.

### UNLABELED_CANDIDATE

A finalized decision with non-empty candidates but a resolution other than `suggestion` or `new`, such as exact existing-key reuse or Alias resolution.

It remains observable but is not force-labeled positive/negative by IA-2L.

### Reviewed Alias assertion

`subject_alias_created` remains a separate explicit equivalence authority.

It is counted separately from ranking-level candidate decisions to avoid double-counting an Alias creation and a later projection save as the same evidence unit.

## 4. Metrics

IA-2L exposes:

- finalized Subject decisions
- candidate-available-at-final-save decisions
- positive reuse decisions
- negative new-Subject decisions
- unlabeled candidate decisions
- new-Subject decisions without candidates
- reviewed Alias equivalence assertions
- candidate decision labels
- candidate label coverage rate
- reuse acceptance rate among labeled candidate decisions

The existing IA-2D organic readiness gate remains unchanged:

- Subject decisions >= 50
- candidate/suggestion-bearing decisions >= 30
- new Subject decisions >= 10

IA-2L does not create a new numeric readiness threshold.

## 5. Hosted starting baseline

Read-only Hosted query before IA-2L implementation returned:

- `ranking_semantic_governance_events`: **0 rows**
- reviewed Alias rows: **0**

Therefore the starting operational status is:

`INSUFFICIENT_OPERATIONAL_EVIDENCE`

No synthetic or controlled row may be inserted into the organic governance stream merely to populate the dashboard.

## 6. Operator surface

Admin-only readback route:

`/admin/measure/equivalence`

The page:

- reads through existing `audit_view` capability,
- exposes no actor identity,
- stores no new data,
- links candidate decisions back to the relevant admin ranking edit page when `ranking_id` still exists,
- clearly distinguishes candidate availability from confirmed UI exposure.

## 7. Safety boundaries

IA-2L MUST preserve:

- `IA_2H_CONTEXT_FALLBACK_QUARANTINED = true`
- lexical deterministic Subject suggestion behavior
- reviewed Alias behavior
- new Subject path
- unclassified path
- `projection_version = 'ia-2b-admin-manual-v1'`
- publication independence
- append-only governance-event privileges

Evidence readback failure must not change Ranking publication or semantic mutation authority.

## 8. What IA-2L can justify later

Only after enough organic evidence accumulates may a later Stage ask questions such as:

- Which candidate patterns are repeatedly accepted?
- Which candidates are repeatedly rejected in favor of new Subjects?
- Which reviewed Alias assertions recur?
- Can a new semantic mechanism be evaluated against these human-finalized decisions?

IA-2L itself does not authorize a new automatic matcher or re-enable IA-2H.
