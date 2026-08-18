# P2-3 Sponsor Transparency / Management — Implementation Evidence

Status: **IMPLEMENTED ON BRANCH / HOSTED MIGRATED / PR VALIDATION PENDING**

## Scope

This implementation promotes legacy sponsorship hints into a normalized, auditable transparency domain without inventing commercial relationships.

Implemented surfaces:

- normalized `sponsors`, `sponsorships`, and append-only `sponsorship_events` tables;
- `sponsorship_manage` admin capability;
- sponsor and sponsorship management RPCs;
- public-safe ranking/item disclosure RPCs;
- ranking publication and placement-save guards;
- integrated `sponsorship_change` audit stream/detail support;
- admin sponsor/sponsorship management pages;
- public ranking/item disclosure UI;
- P2-3 repository contract verifier and CI gate.

## Legacy reconciliation

The only Hosted legacy `ranking_entries.sponsor_flag=true` record was:

- ranking: `best-chicken-breast`
- item: `hankki-grill-sous-vide`

The operator explicitly classified that flag as test/demo data, not a real sponsorship.

The migration therefore:

1. requires that exact one-row prestate;
2. records one append-only `legacy_reconcile` event;
3. does **not** create a sponsor or sponsorship record;
4. sets the legacy flag to false;
5. aborts unless unresolved true flags become zero.

Hosted poststate after migration:

- sponsors: `0`
- sponsorships: `0`
- sponsorship events: `1`
- legacy reconciliation events: `1`
- unresolved legacy sponsor flags: `0`
- current ranking public disclosures: `[]`
- current item public disclosures: `[]`

## Security boundary

Raw sponsorship tables grant no direct privileges to `anon` or `authenticated`.

Public reads are exposed only through bounded SECURITY DEFINER disclosure RPCs. They contain sponsor identity, relationship/disclosure/influence information and relationship dates, but exclude internal notes and actor/admin metadata.

Admin mutations are RPC-only and require `sponsorship_manage`. General audit reads require `audit_view`; sensitive snapshots remain behind `audit_sensitive_view`.

## Editorial integrity

- sponsorship does not alter ranking/search/vote scoring;
- ordinary ranking save no longer materializes legacy sponsor truth and always writes `sponsor_flag=false`;
- a published placement sponsorship prevents ordinary ranking save from silently removing that item;
- a `ranking_type='sponsored'` ranking cannot be published without a published ranking-level sponsorship disclosure;
- placement sponsorship publication requires the ranking/item pair to exist in the current ranking entries.

## Lifecycle evidence

Repository base used for implementation:

`d8058b84a07e7a66937ed39a743b0ceff7dc9f15`

Hosted migrations applied successfully through the Supabase migration authority:

- `p2_3_sponsor_transparency`
- `p2_3_sponsor_audit_integration`

Final PR exact-head CI, merge, merged-main CI, Vercel Production readiness and public smoke remain required before this document can be promoted to `SUCCESS / CLOSED`.
