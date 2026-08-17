# Launch Production QA Suite

## Baseline

- Repository: `gycha0109-beep/ranking`
- Baseline `main`: `08ad96428a92170873c51f1b495077303ac88fcb`
- Production origin: `https://ranking-rho-three.vercel.app`
- Dedicated ordinary-user E2E credentials: GitHub Actions repository secrets `E2E_USER_EMAIL` and `E2E_USER_PASSWORD`

## Goal

Replace repetitive manual launch QA with repeatable Playwright suites against the real production deployment while keeping production mutation scope bounded and auditable.

The launch QA surface is split into two classes:

1. read-only public/compatibility QA that is safe to repeat,
2. credentialed mutation QA that is explicit-only and cleans up current mutable state.

## Read-only production coverage

The public smoke plus compatibility suite verifies:

- core public routes and generated internal links do not resolve to broken pages,
- category cards use public slugs rather than numeric database IDs,
- Unicode slugs, canonical metadata, robots, and sitemap behavior,
- deterministic search discovery for the published `2026 닭가슴살 TOP 10` ranking,
- search sort state and browser back-history restoration,
- keyboard search submission,
- zero-result escape-hatch UX,
- invalid search cursor fail-soft behavior,
- unavailable/invalid Facet state canonicalization,
- signed-out like, bookmark, and comment actions all route to login while preserving `next`,
- published ranking document anatomy: title, ranked items, methodology, criteria, source, item-detail traversal, and back navigation,
- signup entry-form fields without creating a production account,
- horizontal-overflow checks on representative public surfaces,
- delayed requests and repeated reload recovery without page errors or 5xx responses.

Compatibility projects run the compact read-only UX suite on:

- desktop Chromium,
- desktop Firefox,
- desktop WebKit (Safari engine approximation),
- mobile Chromium using a Pixel device profile,
- mobile WebKit using an iPhone device profile.

The mobile projects assert touch capability and phone-sized viewport behavior. This materially exceeds a plain viewport resize, but it is still browser/device emulation rather than physical-device Chrome/Safari. Physical-device touch, browser chrome, OS keyboard, safe-area, and device-specific rendering remain a human/device-lab boundary.

## Credentialed production mutation coverage

The integrated ordinary-user suite verifies:

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

The suite uses one stable published target:

- `/rankings/best-chicken-breast`

Cleanup normalizes current state to like OFF, bookmark OFF, and no live E2E comment. Append-only engagement events and deleted-comment tombstones remain as accepted QA evidence under the dedicated test identity.

A `finally` cleanup block performs best-effort normalization even when a primary assertion fails.

## Production fixture authority and honest gaps

Hosted production was inspected read-only before expanding the suite.

Current facts:

- exactly one published ranking is available: `best-chicken-breast`,
- that ranking currently has 2 ranking entries, 2 criteria, 1 source, and 0 Facets,
- `facet_groups` / `facets` currently expose no production Facet fixtures,
- the published ranking title/summary are short and therefore are not a real long-content layout fixture.

Consequences:

- a real multi-Facet select/combine/remove E2E cannot be claimed until production or a fixture environment has Facet data,
- long-title/long-description overflow cannot be honestly validated against real production ranking content yet,
- vote mutation remains excluded until a dedicated `user_vote` fixture exists,
- actual administrator login cannot be automated without a dedicated non-human admin E2E credential,
- a full fresh-user signup/login/logout lifecycle would create persistent Auth identity/email side effects and therefore is not run against production without an explicit disposable-user cleanup contract,
- duplicate-email signup is likewise not repeated automatically because Supabase Auth may intentionally avoid account-existence disclosure and may cause email/rate-limit side effects.

The suite does test the signup surface itself without submitting it, so basic first-entry form regressions are still covered without production Auth mutation.

## Explicit mutation non-goals

The production QA suite MUST NOT perform:

- comment reports,
- moderation actions,
- sanctions or appeals writes,
- admin/editor writes,
- role or capability changes,
- vote mutations without a dedicated production `user_vote` fixture,
- fresh production account creation without an explicit cleanup contract,
- database writes using a Supabase service/secret key from a Playwright browser job.

## Credential and evidence policy

The credentialed browser workflow receives only:

- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`

from GitHub Actions repository secrets.

It does not receive `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or another privileged database credential.

Trace, screenshot, and video capture are disabled in the authenticated mutation config. Read-only compatibility runs may retain failure diagnostics because they contain no authenticated session.

## Workflow lifecycle

The read-only production E2E workflow is safe to run repeatedly on the QA implementation branch and through `workflow_dispatch`.

The credentialed mutation workflow is `workflow_dispatch` only. It deliberately does not auto-run on branch or `main` pushes so ordinary repository edits do not append production engagement/audit events.

This separation makes the cheap/read-only checks continuous while keeping production writes deliberate.

## Release gate

Before the harness is merge-ready:

1. read-only Chromium public smoke passes,
2. desktop Firefox/WebKit and mobile Chromium/WebKit compatibility smoke passes,
3. credentialed integrated production QA passes once on the final head,
4. Hosted read-only poststate shows no current like/bookmark/live-comment residue for the E2E account,
5. exact-head repository CI passes all existing verifiers, lint, and production build,
6. PR CI passes on the exact feature head,
7. remaining fixture/device boundaries are recorded rather than represented as covered.
