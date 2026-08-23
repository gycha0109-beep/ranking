# AUDIT-R2 — Admin Security Telemetry Trust Boundary

## Purpose

Separate untrusted authenticated self-reports from trusted operational security telemetry without changing administrator authorization semantics or product behavior.

## Audited baseline

Hosted DB baseline:

- `public.record_admin_security_event(...)` is `SECURITY DEFINER`.
- `authenticated` has `EXECUTE`.
- the function only requires an authenticated actor and therefore an ordinary signed-in user can create synthetic security-event buckets.
- `source_trust` existed, but its constraint allowed only `authenticated_self_report`.
- aggregate uniqueness, rate-limit accounting, event listing, and overview did not establish a meaningful trust boundary.
- `get_admin_security_event_overview(...)` aggregated self-reported buckets, allowing signal poisoning.

Impact remained telemetry integrity only:

- no privilege escalation,
- no administrator data read,
- no administrator command execution.

## Trust model

`authenticated_self_report`

- may originate from an authenticated browser/server action input path,
- remains visible to authorized security operators for forensic context,
- is not authoritative operational telemetry,
- is excluded from the operational overview.

`trusted_server`

- may be written only through a service-role/postgres-authorized writer,
- represents a server-verified capability denial or an RPC failure observed after the application passed the relevant administrator capability boundary,
- is the only trust class included in the operational overview.

Existing self-report rows are preserved and are not reclassified.

## Database changes

Migration: `supabase/migrations/20260823070000_audit_r2_admin_security_event_trust_boundary.sql`

The migration:

1. expands `source_trust` to the two explicit trust classes;
2. includes `source_trust` in the bucket aggregate unique key;
3. isolates advisory locking and hourly distinct-bucket limiting by trust class;
4. adds `private.record_admin_security_event_core(...)` with an explicit trust argument;
5. preserves the existing private/public self-report path as `authenticated_self_report`;
6. adds `public.record_trusted_admin_security_event(...)`;
7. revokes the trusted writer from `PUBLIC`, `anon`, and `authenticated`, granting it to `service_role` only;
8. adds a defense-in-depth runtime guard requiring `postgres` session authority or `auth.role() = 'service_role'`;
9. changes `get_admin_security_event_overview(...)` to aggregate only `trusted_server` rows;
10. adds a partial trusted-event recency index for the overview/read path.

## Application producer changes

`src/lib/actions/admin-access.ts` reuses the existing server-only Supabase admin client.

Trusted production is deliberately narrow:

- DB-verified capability denial -> `trusted_server`
- admin RPC failure after capability verification -> `trusted_server`

Pre-validation events remain `authenticated_self_report`, including malformed filters and other inputs that a caller can intentionally trigger.

This prevents an arbitrary caller from converting attacker-controlled validation noise into trusted operational telemetry merely by invoking a server action.

## Read semantics

Authorized security-event list/readback continues to expose both classes with `source_trust`, preserving forensic evidence.

The operational overview cards/high-medium counts consume only `trusted_server` buckets.

## Verification contract

`verify:audit-r2` statically checks:

- two-class trust constraint,
- trust-aware uniqueness/accounting,
- dedicated trusted writer,
- service-role authority guard and grants,
- trusted-only operational overview,
- server admin-client usage for verified failures,
- preservation of self-report paths,
- CI wiring.

Hosted verification must additionally prove:

- anon cannot execute trusted writer,
- ordinary authenticated cannot execute trusted writer,
- self-report writer remains tagged untrusted,
- trusted producer writes `trusted_server`,
- overview excludes self-report buckets,
- authorized admin readback still works,
- legacy self-report telemetry remains preserved.

AUDIT-R2 is not closed until the hosted migration and negative/positive readbacks pass.
