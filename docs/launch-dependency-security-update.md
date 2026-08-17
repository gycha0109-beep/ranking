# Launch Dependency Security Update

## Baseline

- Repository: `gycha0109-beep/ranking`
- Baseline main: `08ad96428a92170873c51f1b495077303ac88fcb`
- Baseline direct Next.js: `16.2.6`
- Database / Hosted data mutation: none

## Audit finding

An exact-lockfile `npm audit --json` against the launch baseline reported 7 known advisories:

- high: 6
- low: 1
- critical: 0

Affected aggregate packages included the direct `next` dependency plus transitive `postcss`, `sharp`, `@babel/core`, `brace-expansion`, and `js-yaml` paths.

A trial update to Next `16.2.11` removed the direct Next advisory range but did not clear the vulnerable transitive dependency graph, so it was rejected as incomplete.

## Final update

The verified bounded update is:

- `next`: `16.3.1`
- `eslint-config-next`: `16.3.1`
- non-breaking `npm audit fix` lockfile resolution for remaining transitive advisories

The resulting lockfile resolves the previously affected transitive packages to safe audit results and `npm audit --json` reports zero known advisories at generation time.

## Verification contract

Before the generated package files are committed, automation requires:

1. `npm audit` total = 0,
2. P1-2 through P2-2 static contracts pass,
3. UI-1 contract passes,
4. LAUNCH-1 contract passes,
5. ESLint passes,
6. Next production build passes.

The final repository branch then receives only the dependency files and this evidence document; the temporary preparation workflow removes itself.

## Runtime follow-up

After merge approval and deployment, rerun the public production smoke/compatibility suite and inspect Vercel runtime errors. This dependency update does not alter database schema or Hosted content.
