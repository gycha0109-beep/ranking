# AUDIT-R3 — Auth Hardening

## Scope

AUDIT-R3 audits the hosted Supabase Auth security posture and verifies that the existing application auth flow remains compatible with stronger password policy. It does not add new product authentication features.

## Hosted findings

### Leaked password protection

Supabase Security Advisor reports:

- lint: `auth_leaked_password_protection`
- state: disabled
- level: WARN

Supabase's current password-security guidance states that leaked-password protection rejects passwords present in the Have I Been Pwned Pwned Passwords corpus and is available on Pro Plan and above.

The current project remains on a plan where leaked-password protection is not available. The warning is therefore retained as an explicit plan-bounded residual rather than imitated in client code or PostgreSQL.

`LEAKED_PASSWORD_PROTECTION = DISABLED / PLAN_RESIDUAL`

No client-side password blacklist or database-side imitation is introduced because neither would be equivalent to Supabase Auth's authoritative password admission policy.

### Email confirmation

Hosted `auth.users` evidence contains email signups where `confirmation_sent_at` precedes `email_confirmed_at` by a separate interval. This is positive runtime evidence that email-confirmation flow has been active for normal email signup.

`EMAIL_CONFIRMATION_RUNTIME_EVIDENCE = VERIFIED`

### Password minimum

During the R3 hosted configuration review, the minimum password length was verified at `8`.

Supabase currently recommends a minimum password length of at least 8 characters.

`HOSTED_PASSWORD_MINIMUM_POLICY = 8 / VERIFIED`

### Password change / reauthentication and advanced session controls

The current application does not expose a user-facing password-change surface in the audited scope. Advanced hosted controls that are plan/configuration dependent are not replaced with speculative application-side substitutes.

No new password-change UI, custom session framework, or duplicate auth policy is added because AUDIT-R3 is hardening, not feature investment.

## Application compatibility

The existing app delegates password admission to Supabase Auth through:

- `signInWithPassword({ email, password })`
- `signUp({ email, password, ... })`

The server action already maps:

- `weak_password`
- `email_not_confirmed`
- auth rate-limit errors
- `captcha_failed`

into explicit user-safe failures. This means stronger hosted password admission remains compatible with the existing application boundary without an authorization redesign or a new product flow.

The login/signup form uses the expected email/password input semantics and `current-password` / `new-password` autocomplete values.

## Repository verification

`verify:audit-r3` preserves the compatibility contract that hosted Auth configuration depends on:

- Supabase remains the authoritative password verifier/admission service;
- weak-password failures remain handled;
- email-confirmation failures remain handled;
- auth rate-limit and CAPTCHA failures remain handled;
- login/signup form password semantics remain intact.

R3 repository merge authority:

- PR #98
- merged `main` SHA: `08926e95a3b174f2e92b5a1af6ead0b22110f3e1`
- required `CI / validate`: passed before merge
- corresponding Vercel Production deployment: `READY`
- Production runtime error/fatal readback at closeout: `0`

## Final closeout readback — 2026-08-24

Current Supabase Security Advisor still reports `auth_leaked_password_protection` as `WARN / disabled`. This is expected and is not hidden by the closeout.

Current Supabase documentation states that leaked-password protection is available on Pro Plan and above, while the Free plan does not include it. A plan upgrade would therefore be required before this specific control can be enabled authoritatively.

The stage is closed for all remediation that is available within the present product scope and plan authority, while retaining the unavailable provider control as an explicit residual.

Final R3 state:

`AUTH_REGRESSION_COMPATIBILITY = VERIFIED`

`HOSTED_PASSWORD_MINIMUM_POLICY = 8 / VERIFIED`

`LEAKED_PASSWORD_PROTECTION = DISABLED / PLAN_BLOCKED_RESIDUAL`

`PRODUCT_SIDE_LEAKED_PASSWORD_IMITATION = NOT_IMPLEMENTED`

`AUDIT_R3 = CLOSED_WITH_PLAN_RESIDUAL`
