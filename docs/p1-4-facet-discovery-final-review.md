# P1-4 Facet Discovery Final Review

## Reviewed state

- implementation review completed
- final design reconciliation updated for retained private P1-3 execution bases
- Hosted migration applied exactly once
- Hosted structure/ACL/behavior/planner/residue gates completed

## Final findings

### Correctness

PASS.

- repeated UUID Facet parameters canonicalize deterministically
- same-group OR / cross-group AND is enforced in DB
- `applies_to` scope rules are enforced in application and DB
- invalid/incompatible public URL Facets degrade safely
- filtered search/browse preserves P1-3 relevance/latest/popular semantics
- cursor fingerprint changes with Facet state while no-filter P1-3 fingerprints remain unchanged
- search and browse keyset fixtures show zero page overlap
- internal 50-row wrapper batch boundary does not truncate highly selective results

### Security

PASS for P1-4 scope.

- public wrappers/options use SECURITY DEFINER only with fixed search path and explicit public moderation predicates
- private P1-3 bases/helpers are not executable by PUBLIC/anon/authenticated
- raw engagement direct-read restrictions remain unchanged
- blocked content does not produce search results or public Facet-option availability
- no filter/query history is persisted

### Performance

PASS for current P1-4 scope.

- no redundant index added
- Hosted EXPLAIN confirms both P1-3 reverse Facet indexes are usable
- selective wrapper scanning can traverse multiple 50-row base batches and has no correctness cap
- if future production cardinality makes wrapper scanning expensive, the internal implementation can be replaced without changing the public contract

### Hosted state

PASS.

- migration: `20260815145454 p1_4_facet_discovery`
- all synthetic validation transactions rolled back
- fixture residue = 0
- no synthetic `ANALYZE`, so planner statistics were not mutated

## Decision

**READY_FOR_EXACT_HEAD_CI**

Required CI sequence:

1. `npm ci`
2. `npm run verify:p1-2`
3. `npm run verify:p1-3`
4. `npm run verify:p1-4`
5. `npm run lint`
6. `npm run build`

PR may be opened only after CI succeeds on the exact final feature HEAD. Merge still requires explicit user approval.