# P2-3 Sponsor Transparency / Management — Design Review

## Verdict

**DESIGN ACCEPTABLE / IMPLEMENTATION NOT STARTED / ONE LEGACY DATA DECISION REQUIRED BEFORE ACTIVATION**

The proposed design is consistent with the current ranking schema, transactional editor, capability model, public-read boundary, and audit architecture. No schema/runtime implementation is part of this review.

## 1. Review question: should existing `sponsor_flag` remain authoritative?

### Rejected

Keeping `ranking_entries.sponsor_flag` as the production truth is insufficient because it answers only a yes/no placement question.

It cannot represent:

- sponsor identity;
- relationship type;
- start/end period;
- disclosure text;
- editorial influence;
- lifecycle/history;
- operator/audit provenance.

### Decision

Use normalized sponsorship records as authority. Keep `sponsor_flag` only as transitional legacy state until explicit reconciliation reaches zero unresolved flags.

## 2. Review question: should sponsorship point to `ranking_entry_id`?

### Rejected

The current ranking save RPC deletes all ranking entries and re-inserts them. Entry UUIDs therefore do not survive normal editing.

A relation keyed to `ranking_entry_id` would either become invalid, block ordinary saves, or be cascade-deleted with disclosure history.

### Decision

Placement target identity is semantic `(ranking_id,item_id)`. The sponsorship record references the ranking and item separately, while publication and save guards verify that the pair exists in the current ranking entries.

## 3. Review question: should placement use a composite FK to `ranking_entries(ranking_id,item_id)`?

### Rejected

Although the pair is unique, the editor's delete/reinsert algorithm makes a direct FK operationally unsafe:

- `RESTRICT` would block every save that temporarily deletes the row;
- `CASCADE` would silently destroy sponsorship disclosure on save.

### Decision

Use independent ranking/item FKs plus explicit application/database integrity checks around publication and ranking mutation.

## 4. Review question: can a sponsor automatically influence rank position?

### Rejected

Automatic score/rank modification would conflict with the product's transparency goal and create hidden coupling with editor scoring, search, voting, and finalization.

### Decision

Sponsorship is disclosure metadata. `influence_scope` records what occurred editorially, but the sponsorship subsystem itself never computes or mutates ranking positions.

## 5. Review question: should ended sponsorship disappear publicly?

### Rejected

Removing past disclosure when a commercial period expires would make historical ranking context misleading.

### Decision

A `published` relationship remains disclosure-visible as history after `ends_at`; the UI labels current versus past relationships. Draft/admin-archived records are not ordinary public projection.

## 6. Review question: can `ranking_type='sponsored'` replace normalized relationships?

### Rejected

The type is useful classification but carries no sponsor identity or disclosure detail.

### Decision

Keep the type for compatibility. A sponsored ranking should not be treated as transparently disclosed unless an appropriate normalized ranking-level published sponsorship exists.

## 7. Review question: who can manage sponsorships?

### Alternatives

- reuse generic `content_manage`;
- hard-code `admin` role;
- add dedicated `sponsorship_manage` capability.

### Decision

Add `sponsorship_manage`.

Reasoning:

- commercial disclosure is higher-sensitivity than ordinary editorial content;
- the repository already has capability-based authorization;
- a dedicated capability permits future delegation without granting role/security administration;
- moderator should not receive it by default;
- admin and super_admin should receive it by default.

New mutations must use capability/RPC authorization rather than copying legacy direct role checks.

## 8. Review question: one table or separate sponsor/relationship tables?

### Rejected: denormalized sponsor text on each placement

This would duplicate sponsor identity and make renames/archive/history inconsistent.

### Decision

Separate:

- `sponsors` = commercial party identity/lifecycle;
- `sponsorships` = relationship to ranking/item/placement;
- `sponsorship_events` = append-only operator history.

This keeps public identity, relation history, and audit provenance distinct.

## 9. Review question: how broad should P2-3 monetization be?

### Rejected for this stage

- billing/payment processing;
- ad serving;
- campaign performance analytics;
- click/impression attribution;
- affiliate settlement;
- sponsor login/portal;
- automated commercial ranking generation.

### Decision

P2-3 is a **transparency and management** stage, not an ad-tech platform.

## 10. Legacy Hosted data review

Hosted has exactly one `sponsor_flag=true` placement and zero `ranking_type='sponsored'` rankings at investigation time.

The flagged placement has no sponsor metadata, internal note, or relationship evidence. The design cannot truthfully decide whether it is:

- a genuine sponsorship;
- seed/demo content;
- an accidental flag.

### Required operator decision

Before normalized P2-3 activation, the operator must classify that single row.

No automatic sponsor inference from brand name is allowed.

No fabricated `unknown sponsor` disclosure is allowed.

This is a **data-truth blocker for activation**, not a blocker to writing or reviewing the implementation code once implementation is explicitly approved.

## 11. Security review

The design is acceptable if implementation preserves all of the following:

- direct sponsor/sponsorship writes are not granted to ordinary anon/authenticated clients;
- mutation actor comes from `auth.uid()`, not browser input;
- capability checks occur server-side/DB-side;
- security-definer functions use fixed search paths and least-privilege grants;
- public projection excludes internal notes and actor IDs;
- audit events cannot be edited/deleted through normal application APIs;
- placement integrity survives the existing ranking-entry recreation behavior.

## 12. Audit review

A sponsorship-specific event source is preferable to burying changes only in generic application logs.

Approved event integration direction:

- domain table `sponsorship_events`;
- existing audit explorer adds `sponsorship_change` event kind;
- event summaries remain safe for `audit_view`;
- sensitive operational details, if surfaced at all, obey the existing sensitive-audit boundary.

## 13. UX review

### Public

Approved principles:

- sponsorship disclosure must be textual, not color-only;
- placement disclosure appears on the affected ranking entry;
- ranking-level disclosure is visible before/around methodology, not buried in footer text;
- item-level relationship is shown on item detail;
- a placement relationship in Ranking A does not globally label the item sponsored in Ranking B;
- current/past relationship distinction is explicit.

### Admin

Approved separation:

- `/admin/sponsors` for party identity/lifecycle;
- `/admin/sponsorships` for target relationship/disclosure/lifecycle.

The ranking editor should cease to be the standalone authority for sponsor state. It may link into sponsorship management, but the existing checkbox is not an adequate production workflow.

## 14. Migration/reconciliation review

Implementation should prefer two bounded migrations:

1. schema/capability/RPC/audit foundation;
2. ranking-save integration, audit-stream integration, and reconciliation/guard hardening.

The current legacy flag must not be cleared by ad-hoc Hosted SQL. Its final reconciliation must be represented by repository-authoritative logic/migration or audited admin action.

## 15. Required implementation evidence

Before merge/activation, evidence must include:

- static `verify:p2-3` contract;
- capability matrix validation;
- direct table privilege denial;
- target-shape and time-window constraint tests;
- placement publication existence guard;
- ordinary ranking save retention/removal guard;
- public projection leakage test;
- expired-history visibility test;
- audit append-only test;
- legacy unresolved count test;
- Hosted migration parity;
- exact-head CI;
- Production public/admin smoke after main deployment.

## 16. Final design judgment

The design is internally consistent and appropriately bounded for P2-3.

It preserves the central product rule:

> Sponsorship may be represented and disclosed, but it must never become hidden ranking authority.

### Current lifecycle

**CURRENT_STATE_REVIEWED / DESIGN_REVIEWED / IMPLEMENTATION_NOT_AUTHORIZED / NOT_ACTIVATED**

### Remaining pre-activation truth question

The existing flagged placement on `best-chicken-breast` position 1 must be classified by the operator before activation as either a genuine commercial relationship or legacy/demo/error data.
