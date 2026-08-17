# Search Form History Synchronization Contract

## Baseline

- Repository: `gycha0109-beep/ranking`
- Baseline `main`: `08ad96428a92170873c51f1b495077303ac88fcb`
- Scope: public `/search` form state only
- Database / Hosted mutation: none

## Production finding

Cross-browser production QA reproduced a URL-to-form state mismatch on WebKit and mobile browser profiles:

1. open `/search?...&sort=relevance`,
2. change the visible sort select to `popular` and submit,
3. navigate back,
4. the URL returns to `sort=relevance`,
5. the visible select can remain `popular`.

The public search form currently uses uncontrolled `defaultValue` fields. Client navigation and browser history may reuse the existing DOM node, so changed server defaults do not guarantee that the live control value is reset to the canonical URL-derived value.

## Contract

The search form must remount whenever its canonical server-provided state changes.

The remount identity must include:

- query,
- search kind,
- search sort,
- selected Facet IDs.

This preserves normal uncontrolled editing while the user remains on one URL, but prevents stale browser-restored form values from surviving a navigation to a different canonical search state.

## Implementation boundary

Use a deterministic React form key derived from the canonical props and apply it to the `<form>` element.

Do not:

- convert the form into a client component solely for this fix,
- add local state/effects,
- change GET search semantics,
- change search ranking/scoring,
- change cursor or Facet contracts,
- change database schema or Hosted data.

## Verification

Static P1-3 contracts must require the canonical form key.

Runtime validation must verify:

- relevance -> popular submission,
- browser back returns URL to relevance,
- visible sort select also returns to relevance,
- behavior on Chromium, Firefox, and WebKit-derived profiles,
- no regression to keyboard search, zero-result, or normal ranking discovery.
