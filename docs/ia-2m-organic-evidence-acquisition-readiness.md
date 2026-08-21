# IA-2M — Organic Evidence Acquisition Readiness Audit

Status: implementation / verification stage

Starting authority:

- main: `dcd84718688ba9dd143cf2ef15fb8b48177f63f8`
- content tree: unchanged from IA-2L merge tree `44597d84971ef0da52f3d493c0b3cf7c64521c52`
- IA-2L: CLOSED
- IA-2H context fallback: QUARANTINED
- Hosted governance events at audit start: 0
- Hosted reviewed Alias rows at audit start: 0

## 1. Purpose

IA-2M does not create semantic evidence, change semantic classification, or introduce a new matcher.

Its only purpose is to verify that the already-authorized organic evidence path is operationally reachable and that the operator can find both the semantic decision surface and the evidence readback surface without knowing hidden URLs.

## 2. End-to-end acquisition path

The audited path is:

```text
/admin
  -> /admin/rankings
  -> /admin/rankings/:id/edit
  -> SemanticProjectionPanel
  -> finalized reviewed semantic decision
  -> ranking_semantic_governance_events append-only evidence
```

The ranking edit page mounts `SemanticProjectionPanel` before the main ranking editor form. The semantic action records finalized governance evidence after a successful reviewed projection save.

IA-2M does not fabricate or insert an organic decision merely to prove this path. Hosted organic evidence remains evidence of actual future operator actions only.

## 3. Readback path gap found

IA-2L introduced:

`/admin/measure/equivalence`

The route is correctly protected by the existing admin authentication/capability boundary, but before IA-2M it had no discoverable entry from the operator console. `/admin` linked only to `/admin/measure`.

Therefore the observed gap is an operator-navigation gap, not an evidence-storage or semantic-save gap.

## 4. Minimal closure

IA-2M adds an `audit_view`-gated operator-console entry for:

- Product & Semantic Evidence -> `/admin/measure`
- Reviewed Equivalence Evidence -> `/admin/measure/equivalence`

No new data path is added.

## 5. Preserved authority boundaries

IA-2M MUST preserve all of the following:

- `ranking_semantic_governance_events` remains the organic semantic-governance evidence authority.
- MEASURE-1 `product_usage_events` remains separate.
- IA-2L interpretation remains `CANDIDATE_AVAILABLE_AT_FINAL_SAVE_NOT_CONFIRMED_UI_EXPOSURE`.
- `IA_2H_CONTEXT_FALLBACK_QUARANTINED = true` remains active.
- `projection_version = 'ia-2b-admin-manual-v1'` remains unchanged.
- No publication state mutation is introduced.
- No synthetic rows are inserted into the organic evidence stream.
- No database migration, RLS policy change, privilege change, event type, matcher, ontology, embedding/vector system, or LLM classifier is introduced.

## 6. Current evidence status

At audit start:

```text
governance_events = 0
reviewed_aliases = 0
```

Therefore:

`INSUFFICIENT_OPERATIONAL_EVIDENCE`

remains the only valid evidence-readiness interpretation.

IA-2M closes navigation/readiness plumbing. It does not close the organic evidence gap itself.

## 7. Exit criteria

IA-2M may close when:

1. `/admin` exposes both evidence destinations to `audit_view` operators.
2. Existing ranking-management navigation still reaches the semantic edit surface.
3. IA-2H quarantine remains active.
4. IA-2L evidence interpretation remains unchanged.
5. No semantic, database, publication, or evidence-write behavior changes.
6. Exact-head CI, lint, and production build pass.
7. Production unauthenticated admin access remains redirected to the login boundary.
8. Production runtime shows no new error/fatal or 5xx regression.
