# P1-5 Technical SEO Hosted Validation

Hosted project: `yjdubukqkcvkymabskzd`.

## Migration state

P1-5 introduces no schema change. Hosted migration head remained:

- `20260815145454 p1_4_facet_discovery`
- `20260815005658 p1_3_search_discovery`
- `20260801195052 p1_2_integration_sanction_enforcement`

No P1-5 migration was applied.

## Public sitemap predicate corpus

Using the exact P1 public predicates at validation time:

- public rankings: 1 (`best-chicken-breast`)
- excluded rankings: 1
- public items: 6
- excluded items: 0
- visible categories: 1 (`foods`)
- visible subcategories under visible categories: 0

This proves the sitemap contract has both included and excluded ranking data to distinguish.

## Anon/RLS validation

SQL role simulation included `request.jwt.claim.role=anon`, matching the RLS policy dependency on `auth.role()`.

Observed:

- anon public rankings: 1
- anon public items: 6
- anon visible categories: 1
- public-safe ranking entries for JSON-LD: 2
- visible subcategories: 0

An earlier role-only simulation without the JWT claim returned zero rankings/items; that was a simulation artifact, not a Hosted permission defect. Re-running with the anon JWT role claim matched the real public predicates.

## Mutation/residue

- No DDL executed.
- No DML fixture inserted.
- No migration applied.
- No persistent Hosted state changed.

Result: `HOSTED_VALIDATION_PASSED`.
