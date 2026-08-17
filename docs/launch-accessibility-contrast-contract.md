# Launch Accessibility Contrast Contract

## Baseline

- Repository: `gycha0109-beep/ranking`
- Baseline `main`: `08ad96428a92170873c51f1b495077303ac88fcb`
- Production origin: `https://ranking-rho-three.vercel.app`
- Database / Hosted mutation: none

## Production automated audit finding

A Chromium + axe-core WCAG automated audit was run against the real production pages:

- `/`
- `/categories`
- `/search?q=닭가슴살`
- `/rankings/best-chicken-breast`
- `/items/heo_steam`
- `/login`

Every sampled page exposed at least one `serious` automated accessibility violation.

The dominant issue is repeated low-contrast muted text from UI-1 arbitrary color utilities. The ranking detail also has one icon-only external source link without a discernible accessible name. The legacy comment compatibility layer leaves the `#comments-heading` white on the new light surface, producing an especially severe contrast failure.

This is an automated audit result, not an accessibility certification.

## Contrast contract

UI-1 legacy muted colors that currently fail on the white / light-gray public surfaces are normalized by the compatibility layer to one darker muted token:

- accessible muted token: `#5f6875`

This color exceeds 4.5:1 against the current main light surfaces (`#ffffff`, `#f6f7f9`, `#f0f2f5`).

The compatibility mapping applies to legacy arbitrary text colors currently observed in the axe failures:

- `#8a94a3`
- `#9aa3af`
- `#a0a8b3`
- `#77808d`
- `#737c89`
- `#7b8491`
- `#667085`
- `#62748e`

The comment compatibility layer must also:

- map legacy `text-slate-500/600/700` to the accessible muted token,
- map textarea/input placeholders to the accessible muted token,
- explicitly render `#comments-heading` with dark UI-1 text instead of legacy `text-white`.

This is intentionally a compatibility normalization rather than a large component-by-component visual redesign.

## Accessible-name contract

Every icon-only external source link on ranking detail must expose a non-empty accessible name derived from the visible source label, e.g. `${source.label} 출처 열기`.

## Non-goals

- no color palette redesign beyond failing muted-text compatibility values,
- no DB/schema/content changes,
- no ARIA added to elements that already have valid native semantics,
- no claim that axe covers all WCAG requirements,
- no physical screen-reader certification in this stage.

## Verification

1. UI-1 static verifier requires the compatibility color mapping and source-link accessible name.
2. Existing verifiers, lint, and production build must pass.
3. Vercel preview must be READY.
4. The same axe production audit is rerun after deployment; sampled pages must have zero serious/critical automated violations before this issue is closed.
