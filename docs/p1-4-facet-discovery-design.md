# P1-4 Facet Advanced Discovery Design

## 1. Goal

Add explainable Facet composition to the P1-3 public discovery paths without changing search scoring, popularity semantics, moderation boundaries, or introducing personalized/semantic retrieval.

## 2. URL contract

Facet selection uses repeated query parameters:

```txt
facet=<facet_uuid>&facet=<facet_uuid>
```

Reasons for UUID URL identity:

- Facet slug is unique only inside a group.
- Group code + Facet slug delimiter contracts would require new slug grammar constraints.
- UUID is already stable and unambiguous.
- Human-readable/SEO Facet URLs can be a later explicit stage.

Application contract:

- deduplicate IDs
- sort IDs lexicographically before fingerprinting or DB calls
- maximum 12 selected Facets
- invalid UUIDs, unknown IDs, and context-incompatible IDs are discarded safely and surfaced as a reset notice

## 3. Composition semantics

For selected Facets:

- same `facet_group_id`: OR
- different `facet_group_id`: AND

Example:

```txt
brand: A OR B
AND
purpose: C
```

A result must have at least one selected Facet from every selected group.

## 4. Applies-to semantics

Selectable/accepted groups depend on content scope:

- search `type=all`: `applies_to=both` only
- search `type=ranking`: `ranking | both`
- search `type=item`: `item | both`
- category/subcategory browse: `ranking | both`

This avoids ambiguous `all` behavior where a ranking-only group would silently constrain only half of a mixed result set.

## 5. Search scope

`/search` still requires a normalized query length of 2–120 characters.

P1-4 does not add query-less global discovery or an `/items` directory. Facets constrain valid P1-3 searches; category/subcategory pages provide query-less ranking discovery.

## 6. Facet option discovery

Add a bounded public metadata RPC that returns Facet options compatible with the requested scope and linked to at least one publicly eligible content row.

Inputs:

- `kind = all | ranking | item`
- optional category slug
- optional subcategory slug

Category/subcategory context is legal only for ranking scope.

Output:

- group id/code/name/applies_to
- Facet id/slug/name

No per-Facet numeric counts are returned in P1-4. A count that ignores currently selected groups would be misleading, while exact dynamic counts add a separate aggregation/performance contract.

## 7. Search/browse RPC extension

Keep existing RPC names:

- `search_public_content`
- `list_public_rankings`

Add optional final parameter:

```sql
p_facet_ids UUID[] DEFAULT '{}'::UUID[]
```

Migration strategy:

1. rename the current P1-3 function temporarily
2. create the new function under the original name with the optional Facet parameter
3. revoke/grant the exact new signature
4. drop the temporary old function

This avoids PostgREST overload ambiguity while old application calls remain valid because the new final parameter has a default.

## 8. DB validation

Search/browse RPCs:

- max 12 unique selected Facets
- selected Facets must exist
- selected groups must be legal for the requested scope
- fixed/minimal search path
- explicit public status + moderation predicates remain unchanged

Facet matching is a constraint only. It must not modify `relevance_score` or `match_reason`.

## 9. Cursor contract

P1-3 cursor payload/keyset fields stay unchanged.

Fingerprint inputs are extended with the canonical sorted Facet ID list.

Consequences:

- changing a Facet invalidates the old cursor
- reordering identical Facets does not invalidate the cursor
- an empty Facet list preserves the prior P1-3 fingerprint input sequence

## 10. UI

Create a reusable public Facet filter panel.

Behavior:

- groups rendered separately
- checkbox multi-select inside a group
- explanatory copy: same group OR, different groups AND
- selected filters shown as removable chips
- clear-all action
- GET forms only
- preserve query/type/sort while filtering
- category/subcategory sort links and next-page links preserve canonical Facet params
- invalid/incompatible Facet state shows a non-fatal reset notice
- if no eligible Facets exist, no empty filter shell is shown

## 11. Security/privacy

No user identity, search history, click history, or filter history is persisted.

No raw engagement table grants are changed.

No hidden/blocked content may become visible or influence public option availability.

## 12. Out of scope

- semantic/vector search
- personalized recommendations
- user search/filter history
- dynamic Facet result counts
- SEO Facet landing-page generation
- query-less global item discovery
- new ranking algorithms
- Facet CMS redesign