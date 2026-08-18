# P2-3 Sponsor Transparency / Management — Design

## Status

**DESIGNED / IMPLEMENTATION NOT AUTHORIZED / NOT ACTIVATED**

## 1. Goal

P2-3 makes commercial relationships explicit, durable, public-safe, and auditable while preserving editorial truth.

A visitor must be able to answer:

1. Who is the sponsor or commercial party?
2. What kind of relationship exists?
3. Which ranking, item, or specific ranking placement is affected?
4. When is or was the relationship active?
5. Did the relationship influence candidate inclusion, ranking order, methodology, or nothing editorial?
6. What disclosure did the operator publish?

Sponsorship metadata must never become an implicit ranking-score boost.

## 2. Non-goals

P2-3 does not implement:

- billing, invoicing, settlement, or payment processing;
- ad auction, bidding, inventory allocation, or dynamic ad serving;
- impression/click attribution analytics;
- affiliate payout accounting;
- automatic ranking boosts or scoring changes;
- sponsor accounts with editorial/admin privileges;
- crawler/import automation;
- a legal/compliance certification or guarantee.

## 3. Normalized data model

### 3.1 `public.sponsors`

Proposed fields:

- `id UUID PRIMARY KEY`
- `name TEXT NOT NULL`
- `slug TEXT NOT NULL UNIQUE`
- `website_url TEXT NULL`
- `status TEXT NOT NULL CHECK (status IN ('active','archived'))`
- `created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL`
- `updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

P2-3 deliberately excludes private CRM contacts, billing data, bank data, negotiated prices, and payment state.

### 3.2 `public.sponsorships`

Proposed fields:

- `id UUID PRIMARY KEY`
- `sponsor_id UUID NOT NULL REFERENCES public.sponsors(id)`
- `target_type TEXT NOT NULL CHECK (target_type IN ('ranking','item','placement'))`
- `ranking_id UUID NULL REFERENCES public.rankings(id)`
- `item_id UUID NULL REFERENCES public.items(id)`
- `relationship_type TEXT NOT NULL`
- `disclosure_text TEXT NOT NULL`
- `influence_scope TEXT NOT NULL`
- `influence_note TEXT NULL`
- `starts_at TIMESTAMPTZ NOT NULL`
- `ends_at TIMESTAMPTZ NULL`
- `status TEXT NOT NULL CHECK (status IN ('draft','published','archived'))`
- `internal_note TEXT NULL`
- `created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL`
- `updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

Target shape must be enforced in the database:

- `ranking`: `ranking_id IS NOT NULL AND item_id IS NULL`
- `item`: `ranking_id IS NULL AND item_id IS NOT NULL`
- `placement`: both IDs are required

Period invariant:

- `ends_at IS NULL OR ends_at > starts_at`

### 3.3 Relationship vocabulary

Initial whitelist:

- `financial_support`
- `product_provided`
- `paid_placement`
- `affiliate`
- `other`

This describes the commercial relationship, not editorial influence.

### 3.4 Editorial influence vocabulary

Initial whitelist:

- `none`
- `candidate_inclusion`
- `ranking_order`
- `methodology`
- `other`

`influence_scope='other'` should require a non-empty `influence_note`.

The UI must never translate `none` into a stronger claim than the operator entered. A typical public statement may be “협찬사는 순위 결정에 참여하지 않았습니다.” only when the stored influence scope truthfully supports it.

## 4. Publication and history semantics

### Draft

A draft sponsorship is admin-only and not part of public disclosure.

### Published

A published sponsorship becomes the authoritative public disclosure record.

Publishing requires:

- active/non-archived sponsor;
- valid target shape;
- non-empty disclosure text;
- relationship type and influence scope;
- valid period;
- placement target currently exists as `(ranking_id,item_id)` in `ranking_entries`.

### Ended relationship

`ends_at` marks the end of the commercial period. It does **not** erase the fact that the relationship existed.

Published expired records remain available in historical disclosure, visually distinguished from current relationships.

### Archive

Archive is an operator lifecycle action, not silent deletion of disclosure history. Published sponsorship rows should not be hard-deleted through normal application paths.

## 5. Placement identity and ranking-save integrity

`ranking_entry_id` must not be used because normal ranking saves delete and recreate entry rows.

For `target_type='placement'`, semantic identity is:

`ranking_id + item_id`

The sponsorship row references `rankings` and `items` separately. Publication checks that the pair currently exists in `ranking_entries`.

### Save guard

`save_ranking_e2e` must be hardened during P2-3 implementation:

- if a published placement sponsorship exists for `(ranking_id,item_id)`, and the new ranking payload removes that item, reject the ranking save;
- the error must instruct the operator to end/archive or otherwise reconcile the sponsorship first;
- retaining the same item is allowed even though its `ranking_entries.id` changes;
- no sponsorship row may be silently cascade-deleted by ordinary ranking editing.

This protects disclosure integrity across the existing delete/reinsert transactional editor.

## 6. Legacy field reconciliation

### `ranking_entries.sponsor_flag`

After P2-3, `sponsor_flag` becomes legacy compatibility state and must not be the public source of truth.

Implementation direction:

- stop allowing ordinary ranking editing to directly toggle the flag;
- public disclosure is derived from normalized `sponsorships`;
- legacy flag cleanup occurs only through explicit audited reconciliation;
- activation requires `unresolved legacy sponsor flags = 0`.

The current Hosted flag must not be automatically transformed into an unknown sponsor record.

### `rankings.ranking_type='sponsored'`

Keep this classification for backward compatibility/content taxonomy, but it is not sufficient disclosure by itself.

Publishing/accepting a `sponsored` ranking should require a valid published ranking-level sponsorship. There are currently no Hosted sponsored rankings, so no current data migration is required for this field.

## 7. Authorization

Add a dedicated admin capability:

`sponsorship_manage`

Recommended capability mapping:

- moderator: no
- admin: yes
- super_admin: yes

All sponsor/sponsorship mutations must use the existing capability/RPC authorization architecture. New P2-3 actions must not reproduce the older direct `user_roles='admin'` helper pattern.

Mutation requirements:

- authenticate with `auth.uid()`;
- verify `sponsorship_manage` server-side;
- derive actor identity server-side;
- fixed `search_path` for security-definer functions where used;
- revoke unsafe default execution/table mutation grants;
- never accept actor IDs from the browser as authority.

## 8. Public read projection

Public clients must receive only disclosure-safe fields.

Recommended public projection/RPC output:

- sponsor name
- sponsor website URL
- target type
- ranking/item target IDs needed for rendering
- relationship type
- disclosure text
- influence scope
- influence note
- starts/ends timestamps
- whether the period is current or historical

Must not expose:

- `internal_note`
- actor IDs
- admin-only audit snapshots
- private operational metadata

Public reads should return `published` records, including expired published history. Draft and archived admin records are excluded from ordinary public disclosure projection.

## 9. Audit model

Add append-only `public.sponsorship_events`.

Proposed fields:

- `id UUID PRIMARY KEY`
- `actor_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL`
- `entity_type TEXT CHECK (entity_type IN ('sponsor','sponsorship'))`
- `entity_id UUID NOT NULL`
- `action TEXT CHECK (action IN ('create','update','publish','archive','legacy_reconcile'))`
- `reason TEXT NULL`
- `before_data JSONB NOT NULL DEFAULT '{}'`
- `after_data JSONB NOT NULL DEFAULT '{}'`
- `created_at TIMESTAMPTZ NOT NULL`

Events are application-append-only: normal authenticated users cannot update/delete them.

Extend the existing audit explorer with a sponsorship event kind such as `sponsorship_change`.

General `audit_view` may see safe summary/detail. Any sensitive internal note should remain outside the general audit summary and, if exposed at all, require the existing sensitive-audit boundary.

## 10. Admin surfaces

### `/admin/sponsors`

Capabilities:

- list sponsors
- create sponsor
- edit public identity/website
- archive sponsor
- show active/published relationship counts

### `/admin/sponsorships`

Capabilities:

- create draft relationship
- choose target type: ranking / item / placement
- select ranking/item target
- set relationship type
- set period
- set editorial influence scope/note
- write disclosure text
- preview public disclosure
- publish
- archive/end lifecycle
- show legacy reconciliation warning/count

Both surfaces require `sponsorship_manage`.

The admin dashboard should surface them only for users with that capability.

## 11. Public surfaces

Create a shared disclosure component, conceptually `SponsorshipDisclosure`.

### Ranking detail

- ranking-level sponsorship: prominent disclosure near ranking header/methodology;
- placement sponsorship: visible disclosure attached to the affected entry;
- current and past disclosures visually differentiated;
- a paid placement inside an ordinary ranking must not look like an unmarked editorial position.

### Item detail

- show only item-level sponsorships as global item disclosures;
- a placement sponsorship in one ranking must **not** mark the item as globally sponsored in unrelated contexts.

## 12. Ranking/scoring isolation

P2-3 must not change:

- relevance search scoring;
- popular/latest ordering;
- editor score computation;
- user-vote aggregation;
- vote finalization order;
- related-content ranking logic;
- canonical ranking positions merely because a sponsor record exists.

If `influence_scope='ranking_order'` is intentionally recorded, the system discloses that fact; it still does not automatically compute or move positions.

## 13. Implementation slices after approval

Recommended lifecycle:

### P2-3A — Schema / authorization / audit

- sponsor + sponsorship + event schema
- constraints/indexes
- `sponsorship_manage`
- mutation/read RPC security contract
- audit stream integration

### P2-3B — Admin management

- sponsor management
- sponsorship draft/publish/archive
- placement integrity validation
- legacy reconciliation tooling

### P2-3C — Ranking save integration / public disclosure

- ranking-save placement guard
- normalized public projection
- ranking/item disclosure UI
- remove legacy checkbox as authoring authority

### P2-3D — Validation / Hosted / Production

- static verifier `verify:p2-3`
- Hosted migration application
- privilege/constraint/data-leak tests
- legacy unresolved count = 0
- exact-head CI
- main merge + Production deployment
- public/admin Production acceptance

## 14. Required validation contract

Implementation is not complete until validation proves:

1. anon/authenticated clients cannot mutate sponsor tables directly.
2. moderator cannot manage sponsorships.
3. admin/super_admin with capability can manage them.
4. target shape constraints reject invalid ranking/item combinations.
5. period constraints reject invalid end time.
6. placement publication rejects a nonexistent ranking/item pair.
7. ranking save cannot silently remove an actively disclosed placement.
8. public projection leaks no internal note or actor identity.
9. expired published relationships remain historically disclosed.
10. audit events are append-only and actor identity is server-derived.
11. sponsorship does not alter ranking/search/vote scoring automatically.
12. all legacy `sponsor_flag=true` rows are explicitly reconciled before activation.

## 15. Activation gate

P2-3 can be implemented behind existing behavior, but normalized sponsorship authority must not be considered activated until:

- repository + Hosted migrations match;
- capability/security validation passes;
- public disclosure validation passes;
- ranking-save integrity guard passes;
- current legacy flag is explicitly classified and reconciled;
- unresolved legacy sponsor flags = `0`;
- CI / Production acceptance passes.

Until then the stage status remains **NOT ACTIVATED**.
