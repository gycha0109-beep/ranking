# P1-4 Facet Discovery Implementation Review

Reviewed implementation commit: `f14e6e556ea25385a9a2a382102f1607c9ed467d`.

## Verdict

APPROVE AFTER DOCUMENT RECONCILIATION AND HOSTED VALIDATION.

No blocking application contract defect was found in the reviewed implementation. One design/implementation difference is intentional and must be documented before Hosted migration.

## 1. Intentional P1-3 base retention

Initial design review described rename/recreate/drop of the previous P1-3 public functions. The implementation instead moves those exact functions into `private` and keeps them as execution bases.

Assessment: improvement, not a regression.

Why:

- no copy of the large P1-3 relevance function
- empty-Facet behavior delegates to the exact prior implementation
- filtered behavior walks the same prior keyset sequence
- public API name remains unchanged
- PostgREST has only one public overload
- private base execution is revoked from PUBLIC/anon/authenticated

Required correction: update final design reconciliation to authorize retained private bases.

## 2. Boolean composition

`private.p1_4_content_matches_facets` groups selected Facets by `facet_group_id` and requires one matching relation inside every selected group.

Result:

- selected Facets within a group are OR
- selected groups are AND

Assessment: matches contract.

## 3. Applicability and invalid state

The application parses UUIDs, deduplicates, sorts, caps at 12, then intersects with the public option set. The DB independently validates existence and `applies_to` compatibility.

Assessment: defense in depth is correct. Direct invalid RPC calls fail; public page URLs degrade safely.

## 4. Search semantics preservation

The wrapper does not recompute P1-3 `relevance_score`, `match_reason`, unique views, likes, or keyset ordering. It filters rows returned from the exact P1-3 base sequence.

Assessment: preserves ranking meaning.

## 5. Pagination correctness

Filtered wrappers advance the internal base cursor over every scanned P1-3 row, not only matching rows, and stop after returning the requested number of matching rows.

The application still requests `page size + 1` and uses the 20th visible row as the next-page cursor. The next call therefore resumes after that visible row and can rediscover the extra lookahead row as intended.

Assessment: no overlap/skip expected; must be proven with Hosted fixture.

## 6. UI and URL persistence

Facet state is preserved through:

- search form submission
- filter form submission
- selected chip removal
- clear all
- latest/popular links
- next-page links

Assessment: matches GET/shareable URL contract.

## 7. Index plan

No P1-4 index is added. Matching uses the existing relation PKs and P1-3 reverse indexes.

Assessment: correct until Hosted EXPLAIN shows otherwise.

## 8. Performance note

The wrapper can scan multiple 50-row P1-3 batches when a Facet combination is highly selective. This favors semantic correctness and avoids duplicating the scoring SQL, but it is a future scale consideration.

Current Hosted corpus is tiny and P1-4 does not introduce a correctness cap. If production cardinality later makes this expensive, a dedicated filtered candidate implementation can replace the private wrapper while retaining the same public contract.

This is non-blocking for P1-4.

## 9. Required Hosted gates

Before exact-head CI:

- migration applies atomically
- public/private RPC ACL matrix is correct
- no-filter behavior remains callable through old argument omission
- OR/AND fixtures pass
- applies-to restrictions pass
- blocked content cannot expose options/results
- search and browse keyset no-overlap pass
- no new index is needed under EXPLAIN evidence
- rollback fixture residue is zero
