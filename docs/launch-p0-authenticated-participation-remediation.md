# LAUNCH P0 — Authenticated Participation Remediation

## Status

Implementation branch: `fix/launch-p0-authenticated-participation`

Baseline main: `36a67669b647daa50223bc64513d34460592be6e`

## Production finding

Manual production QA found three launch-blocking symptoms after a normal user signed in:

1. like/bookmark controls disappeared on public ranking/item detail routes,
2. comment creation returned `댓글 대상 경로가 올바르지 않습니다.`,
3. invalid password login exposed the raw Supabase English message `Invalid login credentials`.

## Root cause

### Public target reads were coupled to the authenticated session

P1-1.5 intentionally separated public content reads from the viewer session. Public ranking/item rows are readable through the anon public client, while the authenticated role is kept behind stricter row policies because authenticated/admin flows retain broader column grants.

Later engagement/comment actions violated that boundary:

- `getEngagementTargetByPath()` used the session client to resolve public ranking/item targets,
- `verifyTargetMatchesPath()` used the session client,
- comment `validateTarget()` used the session client.

When a normal user signs in, those reads execute as `authenticated`. Hosted RLS currently permits public ranking/item SELECT through the anon path or admin access, so a normal authenticated viewer sees zero matching target rows. Engagement therefore returns no target, and comment validation reports an invalid target.

### RLS relaxation is not a safe fix

Hosted read-only verification confirmed:

- normal `authenticated` role currently has column SELECT privilege for `rankings.moderation_review_note`,
- normal `authenticated` role currently has column SELECT privilege for `items.moderation_review_note`,
- normal `authenticated` role currently has column SELECT privilege for `ranking_entries.internal_note`,
- anon does not have those sensitive column privileges.

Therefore changing public row RLS from anon-only to authenticated-visible would expose internal columns to ordinary signed-in users unless the whole admin/public column privilege model were redesigned in the same migration.

This P0 hotfix does **not** change RLS, table grants, or Hosted schema.

## Final contract

### Engagement

- Public ranking/item target existence, slug, status, and moderation checks use `createPublicClient()`.
- Viewer authentication and user-specific RPC state continue to use the session-aware server client.
- Like/bookmark mutations remain authenticated RPC calls.
- Unique-view target verification uses the public client; viewer identity/session handling remains unchanged.

### Comments

- Comment target existence, slug, status, and moderation checks use `createPublicClient()`.
- Comment list/user state and create/update/delete RPCs continue to use the authenticated session client.

### Auth errors

Public login/signup surfaces must not return raw Supabase `error.message` strings.

Auth API errors are mapped by stable `error.code` where known, including:

- `invalid_credentials`
- `email_not_confirmed`
- `weak_password`
- existing-email cases
- invalid email
- signup disabled
- banned user
- request/email rate limits
- CAPTCHA failure

Unknown failures return a generic Korean action-specific message. HTTP 429 also maps to the Korean rate-limit message.

## Database / Hosted state

- repository migration: none
- Hosted migration: none
- persistent Hosted data mutation: none
- RLS policy change: none
- table grant change: none

## Regression gate

`verify:launch-1` now asserts:

- engagement public target reads use `createPublicClient()`,
- comment target validation uses `createPublicClient()`,
- invalid credentials have an explicit Korean mapping,
- raw `return { ok: false, error: error.message }` is forbidden on public auth actions.

## Validation required before merge

1. all repository contract verifiers,
2. ESLint,
3. Next production build,
4. exact-head CI,
5. PR CI,
6. preview/production browser verification after deployment:
   - authenticated like/bookmark controls visible,
   - invalid password error is Korean,
   - comment submission no longer fails target validation,
7. production mutation cleanup is performed manually for any QA comment/like/bookmark used during verification.
