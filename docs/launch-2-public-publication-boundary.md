# LAUNCH-2 — Public Publication Boundary & Index Hygiene

Status: implementation / verification stage

Starting authority:

- accepted main: `ef4f5b35bf87fab9ed56992fe63e2497fdff1cbc`
- IA-2M: CLOSED
- semantic track: `WAITING_FOR_ORGANIC_EVIDENCE`
- organic semantic governance events at audit start: `0`
- reviewed Subject aliases at audit start: `0`

## 1. Why this Stage exists

The next product bottleneck is not another semantic matcher. Production usage is still too small for that authority expansion, while a concrete public-publication leak was observed.

Before LAUNCH-2:

- an `active` Item could be read publicly even when it appeared only in a draft Ranking;
- `search_public_content` could return that draft-only Item because the RPC is `SECURITY DEFINER`;
- a visible Category/Subcategory could be public even with no published Ranking;
- sitemap generation inherited those broad public reads and submitted draft-only/empty URLs for indexing.

Observed examples were:

- draft-only Item `heo_steam`;
- draft-only Item `hankki-grill-sous-vide`;
- visible but empty Category `foods`.

These rows are valid authoring assets. The defect is public visibility, not their existence.

## 2. Authority invariant

LAUNCH-2 freezes this public boundary:

```text
Admin/editor asset existence
!= Public publication authority

Item status = active
!= Public Item

Category is_visible = true
!= Public Category
```

A public Item must satisfy all of the following:

1. Item is `active`.
2. Item moderation and image moderation are public-safe (`clean` or `suggestive`).
3. A moderation-safe `ranking_entries` row references the Item.
4. The parent Ranking is `published`.
5. The parent Ranking moderation and image moderation are public-safe.

A public Category/Subcategory must be visible **and** contain at least one public-safe published Ranking. A Subcategory must also have a visible parent Category.

## 3. Preserved authoring semantics

LAUNCH-2 does **not**:

- delete or archive draft-only Items;
- change draft Ranking content;
- auto-publish anything;
- alter Ranking semantic projections;
- add ontology, LLM, embedding, vector search, or a new semantic matcher;
- equate draft invisibility with invalid content.

Draft assets remain available through existing admin-authorized paths. Publication visibility changes only the anonymous/public authority boundary.

## 4. Enforcement layers

### 4.1 RLS

Anonymous SELECT policies for `items`, `categories`, and `subcategories` enforce the publication boundary directly.

This deliberately makes existing public application readers inherit one central rule because public pages, SEO snapshots, sitemap queries, and related-item queries use the session-independent anon Supabase client.

### 4.2 SECURITY DEFINER search

RLS is not sufficient for `public.search_public_content` because it is `SECURITY DEFINER`.

The RPC therefore applies the Item publication-membership test explicitly while preserving the P1-3 base matcher and keyset cursor semantics. Filtering happens inside bounded batches; hidden rows advance the internal cursor and cannot stall pagination.

### 4.3 SECURITY DEFINER Facet options

`public.list_public_facet_options` explicitly rejects Item Facet evidence that exists only on draft-only Items. Ranking Facet behavior remains based on public-safe published Rankings.

### 4.4 SEO and sitemap

`getItemSeoSnapshot()` and `getPublicSitemapRows()` continue to use the anon public client. No parallel publication predicate is duplicated in the Next.js layer; the DB public-read authority is reused.

Consequences:

- a draft-only Item route resolves to 404/noindex;
- draft-only Items disappear from public search;
- empty visible Categories/Subcategories disappear from public navigation;
- draft-only/empty URLs disappear from sitemap output;
- already-published Items and Rankings remain public and indexable.

## 5. Controlled Production evidence

Immediately after applying the Hosted migration, while the application deployment was otherwise unchanged:

```text
/items/heo_steam                       -> 404 + noindex
/search?q=허닭                         -> 0 results
/categories                            -> foods absent
/items/singapore                       -> 200 + index,follow
/sitemap.xml                           -> 200
```

The sitemap no longer contained:

- `/categories/foods`
- `/items/heo_steam`
- `/items/hankki-grill-sous-vide`

and retained known public Ranking/Item URLs.

This isolates the observed behavior change to the public DB/RPC authority boundary rather than a UI-specific concealment.

## 6. Exit criteria

LAUNCH-2 may close only when all of the following are true:

1. Repository migration matches the Hosted publication-boundary migration.
2. Item/category/subcategory anonymous RLS requires public publication evidence as specified above.
3. `search_public_content` cannot bypass the Item membership boundary, including when no Facet is selected.
4. `list_public_facet_options` cannot surface Facets solely from draft-only Items.
5. Draft-only authoring rows remain present and unchanged.
6. Known public Item/Ranking routes remain readable and indexable.
7. Draft-only Item routes are 404/noindex and absent from public search.
8. Empty Category/Subcategory URLs are absent from public discovery and sitemap.
9. Exact-head CI, all historical verifiers, lint, and production build pass.
10. Exact merge-SHA Production deployment is READY with no new runtime error/fatal or 5xx regression.

## 7. Non-goals

LAUNCH-2 does not claim that Google or another external search engine has indexed the site. It only closes the application-side publication/index hygiene boundary required before acquisition evidence can be interpreted cleanly.
