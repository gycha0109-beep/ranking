# LAUNCH-1 — Production Deployment & Launch Hardening

## Baseline

- repository: `gycha0109-beep/ranking`
- authoritative baseline main: `e6df3bf43fc8b5ee5723a735f756d68a8b19b647`
- UI-1: `SUCCESS / CLOSED`
- Hosted Supabase project: `yjdubukqkcvkymabskzd` (`ACTIVE_HEALTHY` at launch audit)

## Goal

Move the verified application into a real production deployment without changing P1/P2 domain semantics. LAUNCH-1 owns deployment configuration, production-safe account presentation, runtime/SEO/auth smoke validation, and remediation of launch-only blockers.

## Current-state findings

1. The connected Vercel team does not yet contain a `ranking` project, so production deployment requires a project import/creation step outside the repository.
2. Production application code requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. `SUPABASE_SERVICE_ROLE_KEY` is server-only. The current admin bootstrap helper is guarded by `NODE_ENV === development` and therefore must not be used as a production role bootstrap path.
4. `NEXT_PUBLIC_SITE_URL` is the explicit canonical/robots/sitemap production origin. `VERCEL_PROJECT_PRODUCTION_URL` is only the fallback.
5. `/login` remained a pre-UI-1 dark MVP/admin/editor screen and publicly described the internal development bootstrap mechanism. This is a launch blocker even though the bootstrap itself is development-only.
6. `/login`, `/admin`, and `/me` retain `noindex, nofollow`; `/search` and browse query variants retain `noindex, follow`.
7. No LAUNCH-1 database schema or RPC migration is required for the current remediation.

## Remediation contract

### Public account surface

- use the UI-1 light public shell
- frame sign-in/sign-up as ordinary account participation, not admin/editor enrollment
- preserve email/password Supabase authentication behavior
- preserve safe local `next` redirect validation
- never render `ADMIN_BOOTSTRAP_EMAIL`, `.env.local`, service-role information, or development bootstrap instructions to the public UI
- remove MVP/development copy from the public login route

### Environment contract

Production Vercel must receive:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` as a server-only secret if server admin-client paths are required
- `NEXT_PUBLIC_SITE_URL` set to the final production origin once selected

`ADMIN_BOOTSTRAP_EMAIL` is development-only and must not be configured for Production.

## Deployment gate

Repository remediation must complete:

1. implementation review
2. exact-head CI
3. PR CI
4. fresh merge approval
5. merge
6. merged-main exact-SHA CI

After repository closure, Vercel production setup requires:

1. import `gycha0109-beep/ranking`
2. production branch `main`
3. configure production environment variables
4. deploy the exact verified main SHA
5. verify production build/runtime logs
6. browser smoke: home, categories, search, ranking, item, login/account, voting/history/comments, admin authorization
7. verify `robots.txt`, `sitemap.xml`, canonical metadata and noindex surfaces
8. configure/verify Supabase Auth production Site URL / allowed redirect URLs if required by hosted auth behavior

## Exit criteria

LAUNCH-1 closes only when the production deployment points at an exact verified `main` SHA and public/auth/admin/SEO smoke checks have no launch-blocking failure.
