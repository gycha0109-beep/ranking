# P2-3 Sponsor Transparency / Management — Current State

## Status

**INVESTIGATED / NOT IMPLEMENTED / NOT ACTIVATED**

This document records the repository and Hosted Supabase state investigated before P2-3 design. It does not activate sponsorship management and does not change Hosted state.

## Authoritative baseline

- Repository: `gycha0109-beep/ranking`
- investigated `main`: `5070f9133acf8d0caaa057b5d3ba5caf016bb12a`
- Hosted Supabase project: `yjdubukqkcvkymabskzd`
- LAUNCH-1: `SUCCESS / CLOSED`

## Product requirement already present

The existing use-case contract already reserves sponsorship as a P2 monetization/transparency concern:

- `ranking_type='sponsored'` means an advertising/affiliate-based ranking classification.
- visitors must be able to distinguish sponsor exposure from normal editorial ranking content.
- if a sponsored placement appears inside an ordinary ranking, it must be visibly marked.
- the disclosure must state whether sponsorship affects the ranking result or scoring.

The old implementation plan deliberately allowed extension fields such as `sponsor_flag` while excluding sponsor sales/management from P0.

## Existing primitive sponsor fields

P0 already contains two primitive markers:

1. `rankings.ranking_type` allows `sponsored`.
2. `ranking_entries.sponsor_flag BOOLEAN NOT NULL DEFAULT FALSE`.

The public ranking page currently maps `ranking_type='sponsored'` to a sponsorship label and renders a small `스폰서 표기` badge when `entry.sponsor_flag` is true.

The admin ranking editor currently exposes:

- `sponsored` as a ranking type option.
- a per-entry `스폰서 광고` checkbox.

The public query layer includes `sponsor_flag` in entry projection.

These primitives do **not** identify the commercial party, relationship type, disclosure wording, period, editorial influence, lifecycle, or audit history. They are therefore insufficient as a production transparency contract.

## Hosted usage snapshot

Read-only Hosted inspection found:

- sponsored rankings: `0`
- entries with `sponsor_flag=true`: `1`
- total rankings: `1`
- total ranking entries: `2`

The single flagged placement is currently:

- ranking: `best-chicken-breast` (`2026 닭가슴살 TOP 10`)
- position: `1`
- item: `hankki-grill-sous-vide` (`한끼통살 그릴 수비드`)
- brand/creator: `한끼통살`
- `internal_note`: null
- `metadata`: `{}`

The stored row contains no evidence identifying a sponsor, compensation, relationship type, period, or influence policy. P2-3 must therefore **not infer** that this row represents a genuine commercial relationship. It may be a real sponsorship, seed/demo data, or an erroneous legacy flag.

### Legacy activation blocker

Before normalized sponsorship data becomes authoritative, the above legacy flag must be explicitly reconciled by an operator:

- if genuine: create the correct sponsor + normalized placement sponsorship with truthful disclosure details, then retire the legacy flag;
- if not genuine: clear the legacy flag through an audited migration/admin reconciliation path with a reason.

No automatic `unknown sponsor` record is permitted.

## Ranking entry identity is not stable

The current transactional `save_ranking_e2e` implementation deletes all entries for a ranking and re-inserts them on every ranking save.

Therefore:

- `ranking_entries.id` is not stable across ordinary edits;
- a sponsorship relation must **not** foreign-key to `ranking_entry_id`;
- sponsorship tied to a placement must use stable semantic identity based on `ranking_id + item_id`.

The core schema already guarantees `UNIQUE(ranking_id, item_id)`, which makes that semantic pair unambiguous inside a ranking.

A direct composite foreign key to `ranking_entries(ranking_id,item_id)` is also undesirable because the delete/reinsert save algorithm would either block normal editing (`RESTRICT`) or silently delete disclosure records (`CASCADE`). Placement sponsorship must instead reference ranking and item separately and use explicit integrity guards.

## Existing access-control foundation

The project already has capability-based admin authorization using:

- `get_my_admin_access`
- `has_admin_capability`
- server-side denial/security-event recording

Existing capability vocabulary includes content, moderation, sanctions, roles, maintenance, and audit concerns. P2-3 can extend this model rather than introducing a parallel role check.

The legacy `save-ranking.ts` helper still contains a direct `user_roles=admin` check; P2-3 new sponsor mutations must not copy that older pattern.

## Existing audit foundation

The audit explorer currently unions explicit domain event kinds such as:

- role changes
- moderation reviews
- report decisions
- sanctions
- appeals
- maintenance jobs

There is no sponsorship event source yet. P2-3 must add an append-only sponsorship audit source and integrate it into the existing audit explorer contract.

## Hosted migration state

Hosted migration history contains the ranking P1/P2 capability, audit, search, Facet, voting, history, and Launch migrations. There is no P2-3 sponsorship migration.

The Supabase project is shared with unrelated Radar-domain migrations/tables. P2-3 migrations must therefore remain tightly scoped to ranking sponsor objects and must not touch unrelated domains.

## Current-state conclusion

P2-3 does not start from a blank conceptual slate: primitive sponsor classification and placement flags already exist. However, there is no production-grade sponsorship entity, relationship model, disclosure contract, lifecycle, authorization boundary, or audit trail.

The correct P2-3 task is to **promote those primitive markers into a normalized transparency domain without allowing sponsor data to silently affect ranking order or editorial truth**.
