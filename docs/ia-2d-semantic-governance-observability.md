# IA-2D — Semantic Governance Observability & Fragmentation Baseline

Status: **IMPLEMENTATION CANDIDATE**

## Objective

IA-2D measures whether IA-2/IA-2B/IA-2C actually reduce semantic fragmentation without constraining free Ranking creation.

The stage deliberately separates two evidence classes:

1. **Retrospective controlled snapshot** — replay the current canonical Subject corpus through the existing deterministic IA-2C suggestion algorithm.
2. **Organic governance decisions** — append-only evidence created only when an admin finalizes a semantic decision.

The two classes must never be treated as equivalent.

## Authority separation

MEASURE-1 `product_usage_events` remains real-user product/discovery telemetry and keeps its four-event bounded contract unchanged.

IA-2D uses a separate admin/server-only authority:

`ranking_semantic_governance_events`

It stores no arbitrary JSON payload and no real-user behavioral identity. The only actor identity is the authenticated admin UUID responsible for the governance decision.

## Organic event semantics

The append-only stream accepts only:

- `subject_decision_saved`
- `subject_alias_created`
- `subject_alias_deleted`
- `projection_cleared`

A `subject_decision_saved` row records the finalized Subject decision, not every keypress or suggestion impression. At save time the server recomputes the same deterministic Top-5 candidate set used by IA-2C.

Resolution kinds are bounded to:

- `new`
- `existing`
- `alias`
- `suggestion`

When the operator explicitly clicked a deterministic suggestion, the client sends transient selection context. The server recomputes the candidate set and records `suggestion` only if the selected canonical key is still present and equals the final canonical Subject. The original free-form transient query is not persisted.

Evidence write failure does not roll back or block the semantic edit. The mutation returns an operator-visible evidence warning instead, preserving the invariant that semantic governance must not become a publication requirement.

## Retrospective evidence

The operator readout derives current:

- projection count
- canonical Subject count
- singleton Subject count and ratio
- reused Subject count
- Rankings attached to reused Subjects
- reviewed alias count
- duplicate `version_signature` group count
- current Subject density

It also replays each current canonical Subject through `rankRankingSubjectSuggestions()` against the rest of the current corpus.

The resulting pair list is explicitly labeled:

`CONTROLLED_REPLAY_CANDIDATES_NOT_SAME_CONCEPT_LABELS`

These pairs are manual-review candidates only. They do not authorize automatic alias creation, merging, taxonomy restructuring, AI classification, or embedding retrieval.

## Organic metrics

For a selected operator period IA-2D reports:

- Subject decisions
- suggestion exposures at finalized decisions
- deterministic suggestion acceptances
- Top-1 acceptances
- new Subject decisions
- existing Subject reuse
- exact Alias resolutions
- aliases created/deleted
- projections cleared
- finalized decisions that surfaced `same_version` advisories

Derived rates:

- Subject reuse rate
- suggestion acceptance rate
- Top-1 acceptance rate
- Alias resolution rate

## Evidence threshold

Minimum organic sample:

- Subject decisions >= 50
- suggestion exposures >= 30
- new Subject decisions >= 10

Before all three are satisfied the authority must report:

`INSUFFICIENT_OPERATIONAL_EVIDENCE`

After all three are satisfied:

`MINIMUM_ORGANIC_SAMPLE_REACHED`

This threshold does not automatically authorize the next architecture. It only means there is enough operational evidence to evaluate whether stronger Subject governance is justified.

## Security and persistence

`ranking_semantic_governance_events`:

- has RLS enabled;
- grants no direct table or sequence access to `anon` or `authenticated`;
- grants `service_role` only `SELECT` and `INSERT` on the table;
- grants no `UPDATE` or `DELETE` privilege to the application writer;
- uses typed/bounded columns rather than an arbitrary metadata JSON field;
- keeps Ranking/admin foreign keys nullable on parent deletion through `ON DELETE SET NULL`;
- is intentionally low-volume and has no automatic retention job in IA-2D.

## Operator surface

`/admin/measure` remains the existing `audit_view`-guarded evidence console.

The page displays MEASURE-1 and IA-2D together for operator convenience, but labels their authorities separately. IA-2D does not change MEASURE-1 interpretation or make admin governance events eligible product-demand traffic.

## Explicit non-goals

IA-2D does not add:

- AI or LLM classification;
- embeddings/vector search;
- automatic Subject merge;
- automatic Alias creation;
- publication blocking;
- a BI warehouse;
- a third-party analytics service;
- keystroke-level admin analytics;
- stable user behavior tracking.
