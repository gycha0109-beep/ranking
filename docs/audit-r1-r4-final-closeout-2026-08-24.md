# AUDIT R1–R4 Final Closeout — 2026-08-24

## Purpose

This document is the final authority reconciliation for AUDIT-R1 through AUDIT-R4. It supersedes historical `BLOCKED`, `NOT_APPLIED`, and pre-hosted-verification status lines in the individual stage documents where those lines describe an earlier point in time.

No product feature investment is authorized by this closeout.

## Final repository authority before this closeout PR

- Repository: `gycha0109-beep/ranking`
- audited `main`: `b668cae74f5c20755eac2b49f6275b9c77e23e9c`
- open PRs before closeout branch: `0`
- `main.protected = true`
- required status-check context: `validate`
- required status-check enforcement: `everyone`

The repository continues to use PR-based CI validation as the Production-source merge gate.

## Production authority before this closeout PR

Vercel project `ranking` reports the current Production deployment:

- deployment: `dpl_5iUzZenjT2rNstLisYSpL7EGYCTh`
- state: `READY`
- git ref: `main`
- exact git SHA: `b668cae74f5c20755eac2b49f6275b9c77e23e9c`
- current 24-hour runtime error readback: none

This closeout PR is documentation-only. Its merge may create a newer Production deployment SHA without changing application behavior.

## AUDIT-R1 — Repository Production Change Protection

Final state:

- GitHub reports `main.protected = true`.
- required `validate` check is active.
- status-check enforcement is `everyone`.
- PR #98 and PR #99 passed `CI / validate` before merge.
- `.github/workflows/main-ingress-audit.yml` remains defense-in-depth detection and is not treated as a substitute for GitHub protection.

`AUDIT_R1 = SUCCESS / CLOSED`

## AUDIT-R2 — Admin Security Telemetry Trust Boundary

Hosted migration authority:

- hosted version: `20260823071140`
- migration name: `audit_r2_admin_security_event_trust_boundary`

Current hosted readback confirms:

- self-report writer remains available to authenticated callers and is classified as untrusted self-report evidence;
- `record_trusted_admin_security_event(...)` is not executable by `authenticated` and is executable by `service_role`/`postgres` authority;
- the trusted writer contains an explicit `postgres` / `service_role` runtime guard;
- `get_admin_security_event_overview(...)` aggregates only rows where `source_trust = 'trusted_server'`;
- the current security-event bucket table is empty, so closeout does not inject synthetic Production evidence.

Repository authority:

- PR #97
- merged SHA: `f939aa9c054f6e74d34f1d87c5a0f90f873ae15f`

`AUDIT_R2 = SUCCESS / CLOSED`

## AUDIT-R3 — Auth Hardening

Verified stage outcomes:

- application-side auth regression compatibility is preserved;
- hosted minimum password length was verified at `8` during the R3 review;
- email confirmation runtime evidence was observed;
- Production deployment for R3 merge SHA `08926e95a3b174f2e92b5a1af6ead0b22110f3e1` reached `READY` with zero error/fatal runtime findings at closeout.

Residual provider control:

- Supabase Security Advisor currently reports `auth_leaked_password_protection` as `WARN / disabled`;
- Supabase documents leaked-password protection as a Pro-plan-and-above feature and not included on Free;
- no client-side or database-side imitation is introduced.

`AUDIT_R3 = CLOSED_WITH_PLAN_RESIDUAL`

`LEAKED_PASSWORD_PROTECTION = DISABLED / PLAN_BLOCKED_RESIDUAL`

## AUDIT-R4 — RLS / FK Performance Hygiene

Hosted migration authority:

- hosted version: `20260824004213`
- migration name: `audit_r4_rls_fk_performance_hygiene`

Final scoped readback confirms:

- targeted `auth_rls_initplan` findings are absent;
- targeted `multiple_permissive_policies` findings are absent;
- `ranking_criteria.ranking_id` and `ranking_sources.ranking_id` are no longer reported as unindexed foreign keys;
- `idx_ranking_criteria_ranking_id` and `idx_ranking_sources_ranking_id` exist;
- anonymous RLS visibility witness remained `6 / 9 / 16 / 55 / 76 / 16 / 29` during the migration verification window;
- unrelated low-volume FK and unused-index INFO findings remain intentionally visible.

Repository/Production authority:

- PR #99
- merged SHA: `b668cae74f5c20755eac2b49f6275b9c77e23e9c`
- Production: `READY`
- current 24-hour runtime errors: none

`AUDIT_R4 = SUCCESS / CLOSED`

## Dependency security revalidation

A proposed React 19.2.8 security hotfix was revalidated before merge.

The relevant GitHub Reviewed React Server Components advisory applies to the `react-server-dom-webpack`, `react-server-dom-turbopack`, and `react-server-dom-parcel` packages in affected 19.2.x ranges. Repository search found no `react-server-dom-*` dependency entry. The repository is also on Next.js `16.3.1`, which is newer than the patched `16.2.11` line for the July 2026 downstream Server Actions denial-of-service advisory.

PR #100 also contained a non-minimal lockfile mutation (`+424 / -6237`). It was therefore closed without merge, and its branch was reset to the accepted `main` SHA.

Final dependency decision:

`DEPENDENCY_SECURITY_HOTFIX_PR_100 = CLOSED / NOT_MERGED`

`REACT_19_2_8_TOP_LEVEL_BUMP = NOT_ESTABLISHED_AS_REQUIRED`

`NON_MINIMAL_LOCKFILE_MUTATION = REJECTED`

## Residual advisor inventory

Residual Supabase Advisor notices are not hidden by this closeout.

Security residuals include:

- `auth_leaked_password_protection` WARN described above;
- SECURITY DEFINER callable-surface warnings that require function-specific capability/guard semantics and are not mass-remediated solely to reduce advisor count;
- INFO RLS-enabled/no-policy notices on intentionally non-direct-access tables.

Performance residuals include:

- unindexed foreign keys without sufficient current query-path/volume justification;
- unused-index INFO findings that are not deletion authority by themselves.

This audit does not optimize for a zero-warning dashboard at the expense of authorization semantics or evidence-backed indexing.

## Final state

```text
AUDIT_R1 = SUCCESS / CLOSED
AUDIT_R2 = SUCCESS / CLOSED
AUDIT_R3 = CLOSED_WITH_PLAN_RESIDUAL
AUDIT_R4 = SUCCESS / CLOSED

DEPENDENCY_SECURITY_REVALIDATION = COMPLETE
PR_100 = CLOSED / NOT_MERGED

PRODUCT_FEATURE_INVESTMENT = NO_BUILD
OBSERVATION = CONTINUE
```
