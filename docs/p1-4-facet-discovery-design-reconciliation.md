# P1-4 Design Reconciliation / Final Contract

This document is authoritative when P1-4 design and review differ.

## 1. Public URL

Use repeated Facet UUID parameters:

```txt
facet=<uuid>&facet=<uuid>
```

Canonical application state is deduplicated, lexicographically sorted, maximum 12 IDs.

## 2. Boolean semantics

- within one Facet group: OR
- across different Facet groups: AND

A result must satisfy every selected group.

## 3. Applicability

- `type=all`: only `both`
- `type=ranking`: `ranking | both`
- `type=item`: `item | both`
- category/subcategory: `ranking | both`

Unknown/incompatible URL Facets are dropped safely and a reset notice is shown.

## 4. Search behavior

`/search` still requires a 2–120 character normalized query. Facet filtering does not change relevance tiers, fuzzy scoring, match reason, literal LIKE escaping, or popularity ordering.

## 5. Facet options

Add `public.list_public_facet_options` as a public-safe, SECURITY DEFINER, fixed-search-path RPC.

It returns only options linked to at least one publicly eligible row in the requested scope/context. No dynamic counts.

## 6. Existing RPC names

Extend the original names with a final optional `UUID[]` parameter:

```txt
search_public_content(..., p_facet_ids UUID[] DEFAULT '{}')
list_public_rankings(..., p_facet_ids UUID[] DEFAULT '{}')
```

Use transactional rename/recreate/drop to avoid overloaded PostgREST ambiguity and preserve old callers through the default argument.

## 7. DB Facet validation

RPCs canonicalize selected IDs and reject:

- more than 12 unique Facets
- unknown Facet IDs
- groups incompatible with requested kind/context

Application normally removes invalid/incompatible URL values before RPC calls; DB validation is defense in depth for direct callers.

## 8. Cursor

Fingerprint includes canonical Facet IDs. Empty Facet selection keeps the original P1-3 fingerprint input sequence so old no-filter cursor semantics remain stable.

## 9. UI

Add reusable `FacetFilterPanel` to:

- `/search`
- `/categories/[categorySlug]`
- `/categories/[categorySlug]/[subcategorySlug]`

The panel uses GET forms, removable selected chips, clear-all, and preserves q/type/sort. Sort and next-page links preserve canonical Facets.

## 10. Indexes

No new relation indexes by default. Existing P1-3 reverse indexes and relation PKs are the intended access paths. Hosted EXPLAIN is the gate for adding anything else.

## 11. Validation

Hosted rollback fixtures must prove:

- same-group OR
- cross-group AND
- all/ranking/item applicability
- category/subcategory Facet filtering
- relevance/latest/popular preservation
- moderation non-exposure
- option RPC public-only availability
- keyset no-overlap with Facets in fingerprint
- empty Facet backward behavior
- zero fixture residue

## 12. Lifecycle

Implementation -> implementation review -> corrections -> Hosted migration/validation -> exact-head CI -> PR.

Merge requires explicit user approval.