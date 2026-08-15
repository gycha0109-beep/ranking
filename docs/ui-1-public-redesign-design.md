# UI-1 — Public Experience Redesign & Launch Surface Consolidation

## Baseline

- Repository: `gycha0109-beep/ranking`
- Authoritative baseline main: `f6bdbb31c7c32f5c3b1f00e97a5450b69d9ec75b`
- P1: complete
- P2-1 User Voting: `SUCCESS / CLOSED`
- P2-2 Ranking Change History & Vote Finalization: `SUCCESS / CLOSED`

## Goal

Rebuild the public product presentation without changing the established data, search, moderation, engagement, voting, history, or SEO semantics.

The target product language is an editorial knowledge/ranking service rather than a dark SaaS dashboard:

- light neutral canvas
- white content surfaces
- charcoal text
- restrained indigo brand accent
- borders and spacing instead of glassmorphism/glow
- document/list/row hierarchy instead of decorative cards
- ranking positions as the primary visual asset

## In scope

1. Global public design tokens and shell
2. Navbar / footer / search control
3. Home
4. Category directory
5. Category/subcategory browse
6. Search and Facet presentation
7. Ranking detail information hierarchy
8. Item detail information hierarchy
9. Engagement action presentation
10. User voting presentation
11. Ranking history presentation
12. Comment shell visual integration
13. Responsive mobile navigation/filter/action behavior
14. UI-specific CI contract verifier

## Out of scope

- database schema changes
- RPC changes
- search scoring or cursor changes
- moderation policy changes
- voting/finalization semantics changes
- revision/history semantics changes
- SEO/canonical/robots/JSON-LD semantic changes
- crawler/import subsystem
- sponsor transparency domain
- full admin console redesign

## Information architecture contract

### Home

Search and actual content are primary. Marketing/technical labels and decorative statistics are secondary.

### Search / browse

Desktop:

`Facet filter column → result column`

Mobile:

`collapsible Facet filter → results`

Existing query, sort, repeated `facet`, cursor, and canonicalization contracts remain unchanged.

### Ranking detail

Order inside the public page:

1. breadcrumb / title / summary / metadata
2. canonical ranking table
3. methodology / body / criteria
4. candidate scope / Facets / sources
5. related rankings
6. official history / comments through the existing detail layout

The canonical ranking table must precede methodology content.

### Item detail

1. item identity and metadata
2. rankings containing the item
3. related items
4. comments through the existing detail layout

### User voting

Voting remains a separate live-result domain from canonical ranking order. UI-1 may change only presentation. Admin open/close/finalize/void operations remain available and are visually separated from normal viewer controls.

### Engagement

Likes, bookmarks, and daily unique views retain the P1 server actions and optimistic-update behavior. UI-1 presents them as a compact action bar rather than the old dark floating dock.

## Compatibility strategy

`CommentSection` contains mature reply/edit/delete/report/moderation state handling. UI-1 does not rewrite this state machine. The component is mounted inside `rw-comment-shell`, where legacy dark utility surfaces are mapped to the new public light shell. A later cleanup may convert the component utility classes directly after launch-risk work is complete.

## Verification contract

UI-1 CI must verify:

- semantic UI tokens exist
- root public shell no longer forces dark mode
- primary public routes do not reintroduce `#07070a`
- desktop and mobile Facet surfaces both exist
- ranking table precedes methodology
- item detail prioritizes ranking footprint
- voting retains admin terminal controls and does not use the old cyan standalone language
- history renders as a timeline
- ranking/item interaction layouts preserve SEO/data logic and use the light shell
- all P1/P2 verifiers, lint, and production build continue to pass

## Lifecycle

UI-1 follows exact-head CI → PR CI → explicit merge approval → merged-main exact-SHA CI. No merge is allowed before explicit user approval.
