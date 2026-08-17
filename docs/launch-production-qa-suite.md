# Launch Production QA Suite

## Baseline

- Repository: `gycha0109-beep/ranking`
- Baseline `main`: `08ad96428a92170873c51f1b495077303ac88fcb`
- Production origin: `https://ranking-rho-three.vercel.app`
- Public production smoke: already merged and retained as a separate read-only suite
- Dedicated ordinary-user E2E credentials: GitHub Actions repository secrets `E2E_USER_EMAIL` and `E2E_USER_PASSWORD`

## Goal

Replace repetitive manual launch QA with one repeatable Chromium Playwright suite against the real production deployment.

The suite covers browser/session behavior that repository CI and HTTP-only public smoke cannot prove:

1. protected-route redirect when signed out,
2. localized invalid-password feedback,
3. real login and cookie persistence,
4. daily unique-view hydration and same-identity/day dedupe,
5. like add, reload persistence, and remove,
6. bookmark add, `/me/bookmarks` persistence, and direct `저장 해제`,
7. comment create, reload persistence, edit, delete, and absence of the comment-report-state regression,
8. authenticated read-only user pages,
9. ordinary-user admin denial,
10. logout and protected-route denial after logout.

Mobile QA is intentionally deferred from this launch-completion suite. The already-merged public smoke retains its existing viewport check.

## Production mutation boundary

This suite is intentionally narrow and uses only the dedicated E2E ordinary-user account against one stable published target:

- `/rankings/best-chicken-breast`

The account is not an administrator and is not used as a normal end-user account.

Before this suite was introduced, Hosted validation confirmed the dedicated test-account candidate had zero current likes, bookmarks, and live comments.

The suite normalizes mutable current state:

- like -> OFF at cleanup,
- bookmark -> OFF at cleanup,
- created test comment -> deleted through the public UI.

The application deliberately keeps append-only engagement event rows and comment mutation history, and comment deletion is a tombstone rather than physical deletion. Those audit traces are accepted as test evidence under the dedicated E2E identity; they are not ordinary-user content.

A `finally` cleanup block performs best-effort normalization even when a primary assertion fails.

## Explicit non-goals

The production QA suite MUST NOT perform:

- comment reports,
- moderation actions,
- sanctions or appeals,
- admin writes,
- ranking/content editor writes,
- role or capability changes,
- vote mutations without a dedicated production `user_vote` fixture,
- database writes using a Supabase service/secret key from the Playwright job.

Those belong to isolated fixture/staging coverage when needed.

## Credential and evidence policy

The workflow receives only:

- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`

from GitHub Actions repository secrets.

The browser job does not receive `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or any other privileged database credential.

Playwright trace, video, and screenshots are disabled for this authenticated mutation suite to avoid persisting session or credential-adjacent browser artifacts. The HTML test report is retained for short-lived execution evidence.

## Workflow lifecycle

During implementation the workflow auto-runs only on pushes to:

- `test/launch-production-qa-suite`

It also supports manual `workflow_dispatch` against an explicitly supplied base URL.

It does not auto-run on `main`, so merging the test harness does not repeatedly mutate production engagement/audit streams on every application commit.

The existing public production smoke workflow is narrowed to execute only `tests/e2e/production-smoke.spec.mjs`, ensuring it never picks up the credentialed QA spec.

## Release gate

Before this test harness is merge-ready:

1. integrated production QA passes against the real production origin,
2. Hosted read-only poststate shows no current like/bookmark/live-comment residue for the E2E account,
3. exact-head repository CI passes all existing verifiers, lint, and production build,
4. the branch diff contains no application or database behavior changes,
5. PR CI passes on the exact feature head.

After those gates, the stale authenticated-smoke PR #25 is superseded by this integrated suite and should be closed unmerged.
