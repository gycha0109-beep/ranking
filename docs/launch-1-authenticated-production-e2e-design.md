# LAUNCH-1 Authenticated Production E2E Design

## Baseline

- Repository: `gycha0109-beep/ranking`
- Baseline `main`: `36a67669b647daa50223bc64513d34460592be6e`
- Public production smoke workflow: merged by PR #24
- Production origin: `https://ranking-rho-three.vercel.app`

## Goal

Add a repeatable authenticated production smoke test without contaminating production engagement, moderation, ranking history, or audit data.

This stage verifies the session and authorization boundary that the public smoke suite cannot cover:

1. unauthenticated access to a user-only page redirects to login with a safe local `next` path,
2. a dedicated ordinary user can log in through the real production login UI,
3. the authenticated session survives a reload,
4. read-only user pages are accessible,
5. an ordinary user cannot enter `/admin`,
6. logout clears the authenticated session,
7. the protected user page is protected again after logout.

## Production mutation boundary

Authenticated production E2E MUST NOT repeatedly create or mutate user engagement data.

Repository and hosted-function inspection shows:

- likes are physically reversible in `content_likes`, but every request appends `content_like_events`, including unlike,
- bookmarks are physically reversible in `content_bookmarks`, but every request appends `content_bookmark_events`, including removal,
- comment deletion is a soft delete (`status='deleted'`) and appends `comment_mutation_events`,
- there are currently no `user_vote` rankings in the hosted project.

Therefore the production authenticated suite is intentionally read-only after authentication. Like/bookmark/comment/vote mutation E2E belongs on an isolated Supabase development branch or staging project where fixtures can be reset without polluting production history.

## Test account contract

Use one dedicated Supabase Auth account that is:

- email-confirmed,
- not an admin/operator,
- not sanctioned,
- used only for automated smoke tests,
- configured in GitHub Actions repository secrets, never committed to the repository or pasted into workflow inputs.

Required repository secrets:

- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`

The hosted project currently contains a confirmed, role-free `radar-test@example.com` account with no likes, bookmarks, comments, or votes. It is a suitable candidate only if its password is intentionally controlled for this E2E purpose. The workflow does not assume that email value; the secret is authoritative.

## Workflow behavior

`Production Auth E2E` uses Playwright Chromium against `E2E_BASE_URL`.

Triggers:

- push to `feat/launch-1-authenticated-e2e` while this stage is under development,
- manual `workflow_dispatch` for repeat production verification.

Credential behavior:

- secrets are mapped to environment variables,
- if either secret is missing, the feature-branch run reports the authenticated suite as intentionally skipped rather than printing or guessing credentials,
- once both secrets are present, the real authenticated browser smoke runs.

No Supabase service-role or secret key is required by this workflow.

## Browser sequence

The authenticated test uses a single browser context so cookie persistence is part of the contract:

1. open `/me/bookmarks` signed out,
2. confirm redirect to `/login?next=%2Fme%2Fbookmarks`,
3. fill `이메일` and `비밀번호`,
4. submit `로그인`,
5. confirm navigation to `/me/bookmarks`,
6. confirm heading `내 북마크`,
7. confirm the navbar exposes the authenticated account email,
8. reload and confirm the same authenticated state remains,
9. visit `/me/notifications` and `/me/sanctions` and require a healthy non-login response,
10. visit `/admin` and require redirect away from the admin console with `error=not_authorized`,
11. return home, open the desktop account menu, submit `로그아웃`,
12. confirm the public navbar shows `로그인`,
13. revisit `/me/bookmarks` and require login redirect again.

## Failure evidence

- trace retained on failure,
- screenshot retained on failure,
- video retained on failure,
- HTML Playwright report uploaded for 7 days.

## Mutation E2E follow-up

A separate staging fixture suite should later cover:

- like add / persist / remove,
- bookmark add / `/me/bookmarks` persistence / remove,
- comment create / edit / delete,
- vote cast / change / cancel when a `user_vote` fixture exists,
- ordinary-user admin denial,
- administrator read/write paths that are safe inside an isolated fixture DB.

That suite requires an isolated Supabase development branch or staging project and must not target production mutation tables.
