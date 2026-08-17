# Launch Response Security Headers Contract

## Baseline

- Repository: `gycha0109-beep/ranking`
- Baseline `main`: `08ad96428a92170873c51f1b495077303ac88fcb`
- Production: `https://ranking-rho-three.vercel.app`
- DB / Hosted data mutation: none

## Production observation

The current Vercel production response already supplies HSTS, but the application response exposes `X-Powered-By: Next.js` and does not currently supply several low-risk baseline browser security headers.

## Contract

The application configuration must:

- disable the framework `X-Powered-By` response header,
- send `X-Content-Type-Options: nosniff`,
- send `Referrer-Policy: strict-origin-when-cross-origin`,
- send `X-Frame-Options: DENY`,
- send `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

Apply these headers to all application paths.

## Deliberate non-goals

- Do not duplicate Vercel-managed HSTS in application config.
- Do not add a Content Security Policy without a dedicated Next.js nonce / RSC / third-party resource contract.
- Do not add COOP/COEP without explicit compatibility review.
- Do not add legacy `X-XSS-Protection`.

No current repository usage of iframes, geolocation, camera, microphone, or `getUserMedia` was found before applying the policy.

## Verification

1. static LAUNCH-1 verifier requires the exact low-risk header contract,
2. lint and production build pass,
3. Vercel preview response shows the expected headers,
4. preview no longer exposes `X-Powered-By`,
5. existing public smoke remains unaffected after deployment.
