# P1-4 Facet Advanced Discovery Design Review

## Verdict

APPROVE WITH RECONCILIATION.

The design fits the existing P1-3 discovery architecture, but the following points are mandatory before implementation.

## 1. Avoid slug-composition URL contracts

A `group:facet` public token looks readable but the current CMS does not enforce a delimiter-safe grammar. Do not introduce hidden assumptions about `code`/`slug` syntax in this stage.

Resolution: use repeated Facet UUID parameters for P1-4. Human-readable Facet URLs remain future work.

## 2. Do not use partial application semantics for `type=all`

Applying ranking-only Facets only to ranking rows while leaving item rows unconstrained would make a single filter mean two different things.

Resolution: mixed `all` scope exposes and accepts only `applies_to=both` groups.

## 3. Preserve P1-3 relevance meaning

Selected Facets are constraints, not relevance boosters. A row must not receive a higher score merely because the user selected one of its Facets.

Resolution: apply Facet predicates inside ranking/item candidate eligibility while leaving P1-3 score tiers and match reasons unchanged.

## 4. Avoid inaccurate Facet counts

Static counts that ignore the other active groups are misleading; exact counts would add substantial aggregation and pagination-planner complexity.

Resolution: P1-4 returns only eligible options, no numeric option counts.

## 5. Do not add redundant indexes

P1-3 already created reverse Facet indexes and the relation PKs cover the opposite lookup direction.

Resolution: no new Facet relation index unless Hosted EXPLAIN proves a missing access path.

## 6. Prevent RPC overload ambiguity

Adding an overloaded `search_public_content` with a default final parameter can become ambiguous through PostgREST.

Resolution: transactional rename -> recreate original name with optional `UUID[]` -> drop temporary old function. Repeat for ranking browse.

## 7. Canonicalize before cursor fingerprinting

Selection order and duplicate query parameters must not create different logical cursors.

Resolution: application dedupe + lexical UUID sort; DB repeats its own dedupe and validates max 12 unique IDs.

## 8. Preserve backward compatibility

During migration-first deployment, the currently deployed P1-3 app must continue calling the same RPC names without supplying Facets.

Resolution: the new Facet parameter is final and defaulted to an empty UUID array.

## 9. Public option availability must obey moderation

Facet metadata itself is public, but a new option endpoint must not infer availability from blocked/hidden content.

Resolution: option RPC uses the same ranking/item public predicates as P1-3.

## 10. Hosted validation requirement

Because Hosted currently has zero Facet rows, validation must use rollback fixtures covering OR/AND, applies-to restrictions, moderation non-leakage, sort preservation, and keyset pagination. Fixture residue must be zero.