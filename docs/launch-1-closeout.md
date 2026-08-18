# LAUNCH-1 Production Deployment & Launch Hardening — Closeout

## Result

**SUCCESS / CLOSED**

LAUNCH-1의 repository, Vercel Production, browser/runtime acceptance 및 반복 가능한 Production QA lifecycle을 완료했습니다.

이 문서는 closeout 시점의 검증된 **application acceptance baseline**을 기록합니다. 이후 문서-only closeout merge는 새 `main` SHA를 만들 수 있지만, 아래 baseline과 동일한 application runtime tree 위에 문서만 추가합니다.

## Authoritative application baseline

- Repository: `gycha0109-beep/ranking`
- accepted `main`: `e98685ba687604420195760f7232acb79204285f`
- merge source: PR #28 `test: add integrated production QA suite`
- PR #28 final head: `34934b597a17715e27e298873e8d0f126c5a2531`
- merged-main tree: `a069a7dd2868ef174c23e67e6d32e5f9f728a20b`
- Production origin: `https://ranking-rho-three.vercel.app`
- Production deployment: `dpl_7iHADEyzHTRun9psjEyvsuCK8dyy`

The merge commit and the final validated PR head differ only by the merge commit itself; their file trees have no application-content delta.

## Repository validation

Final PR CI before merge:

- workflow: `CI`
- run number: `#176`
- run id: `32098228319`
- exact PR head: `34934b597a17715e27e298873e8d0f126c5a2531`
- result: **SUCCESS**

Validated gates:

- `npm ci`
- P1-2 / P1-3 / P1-4 / P1-5 contract verification
- P2-1 / P2-2 contract verification
- UI-1 contract verification
- LAUNCH-1 contract verification
- ESLint
- production build

## Production acceptance

Final read-only Production E2E:

- workflow: `Production E2E Smoke`
- run number: `#19`
- run id: `32098228298`
- target Production main at execution: `c0ac595abbf2e454b71f2f4886f0907cb7e56ba5`
- result: **SUCCESS**

Passed stages:

1. deep Chromium public Production smoke
2. automated axe accessibility acceptance on six representative public pages with zero `serious` / `critical` violations
3. cross-browser/mobile-emulated read-only UX compatibility

Compatibility profiles:

- Desktop Chromium
- Desktop Firefox
- Desktop WebKit
- Pixel 5 mobile Chromium emulation
- iPhone 13 mobile WebKit emulation

The strict search-history regression `relevance -> popular -> browser Back` restores both canonical URL state and the visible sort control across the compatibility matrix.

## Launch remediation closed during acceptance

Production QA found and closed two additional runtime regressions before final acceptance:

- login secondary-text contrast violation: remediated before the final axe pass
- Chromium/WebKit session-history/BFCache search-control desynchronization: remediated before the final compatibility pass

The acceptance assertion was not weakened to hide either defect; product behavior was changed and Production was retested.

## Production deployment and runtime state

At closeout readback:

- Vercel deployment for accepted merge SHA `e98685ba687604420195760f7232acb79204285f`: **READY**
- GitHub Vercel commit status: **success**
- Production origin HTTP response: **200 OK**
- recent Vercel runtime error query: **0 errors found**
- response hardening observed on Production includes `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and bounded `Permissions-Policy`
- `X-Powered-By` is not exposed

## Git deployment policy

Repository `vercel.json` now enforces:

- `main`: deployment enabled
- all non-main branches: deployment disabled

The policy was verified by real non-main commits producing no Preview deployment and by `main` merges producing Production deployments.

## Production QA lifecycle

The merged QA system separates repeatable read-only checks from explicit mutation checks:

- public/cross-browser/accessibility Production QA may run repeatedly
- authenticated mutation QA remains `workflow_dispatch` only
- repository pushes do not automatically create Production engagement/audit writes
- credentialed QA uses ordinary-user credentials rather than privileged Supabase service credentials in the browser runner

Current fixture/device limitations remain explicit rather than being represented as covered. See `docs/launch-production-qa-suite.md` for the detailed scope and non-goals.

## Hosted / database scope

LAUNCH-1 closeout introduces no new Supabase schema or RPC migration. Persistent Hosted changes remain governed by repository migrations.

## Next lifecycle

The next planned product stage is **P2-3 Sponsor Transparency / Management**.

P2-3 is not implemented or activated by this closeout. It requires its own current-main investigation, design, security/data-contract review, implementation approval, migration/Hosted validation if needed, exact-head CI, Production acceptance, and merge lifecycle.

External data import / crawling remains deferred until actual Production operation demonstrates that manual content entry is a material bottleneck.
