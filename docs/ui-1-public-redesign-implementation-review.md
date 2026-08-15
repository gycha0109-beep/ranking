# UI-1 Implementation Review

## Scope review

Implementation is presentation-only. No Supabase migration, schema, RPC, search ranking, moderation, voting, finalization, or history semantic code was changed.

## Implemented surfaces

- semantic light design tokens and compatibility primitives
- root public shell / footer
- responsive Navbar and account/mobile menus
- SearchForm
- home
- category directory
- category browse
- subcategory browse
- search results
- desktop/mobile Facet presentation
- ranking detail hierarchy
- item detail hierarchy
- compact engagement action bar
- user voting presentation with separated operator controls
- official ranking-history timeline
- ranking/item layout wrappers for voting/history/comments
- `verify:ui-1` CI gate

## Review findings and fixes

### 1. Synthetic latest-ranking navigation

Initial Navbar implementation exposed a `최신 랭킹` link by executing a literal search for `랭킹` with `sort=latest`. This was not an actual global latest-ranking route and could misrepresent the product navigation.

Resolution: removed the synthetic route. Existing valid entry points remain Category, Search, Saved content, Notifications, Account, and Operator Console.

### 2. Stateful CommentSection rewrite risk

`CommentSection` contains mature logic for pagination, authentication, create, reply, edit, optimistic state refresh, delete conflicts, moderation visibility, and reporting. Rewriting it solely for UI-1 would unnecessarily increase behavioral regression risk.

Resolution: preserve the component logic and use a scoped `rw-comment-shell` compatibility layer to map legacy dark utility styling into the public light shell. This is an explicit transitional implementation, not a new comment-domain contract.

### 3. Voting administration hierarchy

P2-1/P2-2 operator controls were previously visually colocated with viewer voting controls.

Resolution: preserve every server action and validation path while moving operator open/close/finalize/void controls into a separate collapsible admin surface.

### 4. Ranking content priority

The legacy ranking detail displayed body/criteria/scope before the ranking table.

Resolution: canonical ranking entries are now the first primary content section after the page header. Methodology, scope, Facets, and sources follow.

## Known non-blocking follow-up

- `CommentSection` utility classes can be converted directly to semantic UI primitives after launch hardening; current scoped compatibility mapping is intentionally retained to reduce functional risk.
- UI-1 does not fully redesign `/admin` or account-only pages. Global shell changes apply, but those surfaces remain a later polish concern if launch smoke testing identifies a usability blocker.
- Voting is still mounted by the ranking detail layout before the page component. The voting surface is now visually integrated and restrained; changing its data-fetch/mount boundary would add avoidable semantic risk in UI-1.

## Required validation

Before PR creation:

1. feature branch must be based on authoritative main with `behind=0`
2. exact-head helper branch must point to the final feature SHA
3. all existing P1/P2 contract verifiers must pass
4. `verify:ui-1` must pass
5. ESLint must pass
6. Next production build must pass

PR merge remains blocked until explicit approval after exact-head and PR CI success.
