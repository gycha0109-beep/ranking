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

The setting belongs to hosted Auth configuration, not PostgreSQL schema configuration. Supabase exposes hosted Auth configuration through the Dashboard and the Management API endpoints:

- `GET /v1/projects/{ref}/config/auth`
- `PATCH /v1/projects/{ref}/config/auth`

The currently connected Supabase authority exposes database/project/advisor operations but does not expose hosted Auth-config GET/PATCH. Therefore neither the complete hosted Auth config nor an authoritative config mutation can be performed from this continuation.

`LEAKED_PASSWORD_PROTECTION = BLOCKED_BY_EXTERNAL_AUTHORITY`

No client-side password blacklist or database-side imitation is introduced because neither would be equivalent to Supabase Auth's authoritative password admission policy.

### Email confirmation

Hosted `auth.users` evidence contains recent email signups where `confirmation_sent_at` precedes `email_confirmed_at` by a separate interval. This is positive runtime evidence that email-confirmation flow has been active for normal email signup.

`EMAIL_CONFIRMATION_RUNTIME_EVIDENCE = VERIFIED`

This evidence does not substitute for a current Management API config readback, so the exact provider toggle remains externally authoritative.

### Password minimum / required characters

The current hosted values cannot be read authoritatively with the connected surface.

Supabase recommends a minimum password length of at least 8 characters and exposes password-strength requirements in Auth settings. The application does not impose a competing client-only password policy; admission remains owned by Supabase Auth.

`HOSTED_PASSWORD_MINIMUM_POLICY = UNKNOWN_EXTERNAL_CONFIG`

`HOSTED_REQUIRED_CHARACTER_POLICY = UNKNOWN_EXTERNAL_CONFIG`

### Password change / reauthentication

The current application exposes email/password sign-in and sign-up but no user-facing password-change or recovery surface in the audited scope. Supabase supports requiring recent reauthentication or the current password for password changes, but the hosted toggle values cannot be authoritatively read here.

`PASSWORD_CHANGE_REAUTH_CONFIG = UNKNOWN_EXTERNAL_CONFIG`

No speculative password-change UI is added because AUDIT-R3 is hardening, not feature investment.

### Session/security configuration

JWT/session lifetime, refresh-token reuse, CAPTCHA/provider settings, and related hosted Auth parameters require hosted Auth config readback for an authoritative claim. They are therefore not inferred from database rows or client behavior.

`HOSTED_SESSION_SECURITY_CONFIG = UNKNOWN_EXTERNAL_CONFIG`

## Application compatibility

The existing app delegates password admission to Supabase Auth through:

- `signInWithPassword({ email, password })`
- `signUp({ email, password, ... })`

The server action already maps:

- `weak_password`
- `email_not_confirmed`
- auth rate-limit errors
- `captcha_failed`

into explicit user-safe failures. This means enabling a stronger hosted password policy does not require an authorization redesign or a new product flow.

The login/signup form uses the expected email/password input semantics and `current-password` / `new-password` autocomplete values.

## Repository verification

`verify:audit-r3` preserves the compatibility contract that stronger hosted Auth configuration depends on:

- Supabase remains the authoritative password verifier/admission service;
- weak-password failures remain handled;
- email-confirmation failures remain handled;
- auth rate-limit and CAPTCHA failures remain handled;
- login/signup form password semantics remain intact.

## Required external close action

To close the hosted-setting portion of AUDIT-R3, an authorized Supabase Dashboard or Management API actor must:

1. read current hosted Auth config;
2. verify the subscription tier supports leaked-password protection;
3. enable leaked-password protection;
4. set/review minimum password strength (at least 8 characters per current Supabase guidance);
5. review email confirmation, password-change reauthentication, CAPTCHA/rate limits, JWT/session lifetime, and refresh-token security settings;
6. save settings;
7. perform an authoritative config readback;
8. run signup/signin regression against Production.

Until that readback exists:

`AUTH_REGRESSION_COMPATIBILITY = VERIFIED`

`AUTH_CONFIG_MUTATION = BLOCKED_BY_CONNECTED_SUPABASE_AUTHORITY`

`AUDIT_R3 = BLOCKED`
