# P1-4 Facet Discovery Current State

Authoritative baseline: `main` at `76eeff7a37f2ce80d89a27dbc319a9bf86a98d12`.

## 1. Existing public discovery

P1-3 currently provides:

- `/search?q=&type=all|ranking|item&sort=relevance|latest|popular&cursor=`
- category/subcategory ranking browse with `latest|popular`
- stable keyset pagination
- ranking/item Facet text as a search relevance signal
- explicit public moderation predicates

What is not present:

- user-selectable Facet filters
- multi-Facet composition semantics
- Facet state in cursor fingerprints
- public Facet option discovery UI
- URL-persisted Facet selection

## 2. Existing data model

The schema already has:

- `facet_groups(id, code, name, description, applies_to, ...)`
- `facets(id, facet_group_id, name, slug, description, ...)`
- `ranking_facets(ranking_id, facet_id)`
- `item_facets(item_id, facet_id)`

`facet_groups.applies_to` is constrained to `ranking | item | both`.

P1-3 already added reverse indexes:

- `ranking_facets(facet_id, ranking_id)`
- `item_facets(facet_id, item_id)`

The PKs also cover `(ranking_id, facet_id)` and `(item_id, facet_id)`, so both selection-to-content and content-to-selection lookup paths already exist.

## 3. Hosted state

At design time Hosted contains:

- Facet groups: 0
- Facets: 0
- ranking-Facet links: 0
- item-Facet links: 0
- publicly eligible rankings: 1
- publicly eligible items: 6

Therefore P1-4 validation cannot rely on current production Facet rows. All behavior must be proven with transaction-rollback synthetic fixtures and leave zero fixture residue.

## 4. Public metadata access

`facet_groups`, `facets`, `ranking_facets`, and `item_facets` currently have SELECT privilege for anon/authenticated roles. P1-4 will not broaden these grants.

The new public Facet option read path still needs explicit public-content predicates so option availability does not depend on hidden or blocked content.

## 5. Constraints carried forward

P1-4 must not change P1-3 search relevance tiers, popularity ordering, moderation predicates, query normalization, literal wildcard handling, or keyset ordering.

P1-4 is a filter constraint layer over existing public search/browse semantics, not a new recommendation/search engine.