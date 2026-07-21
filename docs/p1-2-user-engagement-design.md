# P1-2 User Engagement System Design

## 1. Goal

Turn 랭킹위키 from a read-only publishing CMS into a user-participation service without weakening the current public-data, moderation, and transactional-save baselines.

P1-2 covers four capabilities:

1. Ranking and item likes
2. Ranking and item bookmarks
3. Unique ranking and item views
4. Ranking and item comments with one-level replies and Moderation integration

This phase does not introduce recommendation ranking, notification delivery, social following, user reputation, AI summarization, or analytics dashboards.

## 2. Existing baseline

The current database already has:

- `profiles(id, display_name, avatar_url)`
- `rankings` and `items`
- `comments` with `ranking_id`, `item_id`, `parent_id`, body, lifecycle status, timestamps, and Moderation fields
- entity-specific Moderation review RPCs and append-only `moderation_reviews`
- public anon reads restricted to explicit safe columns
- authenticated admin and user identity through Supabase Auth

The existing `comments` table can be retained, but it needs stronger target constraints, reply constraints, author-edit rules, and public-safe query boundaries.

## 3. Scope decomposition

### P1-2.1 Reactions

Implement likes first because they establish the shared target model, authenticated mutation pattern, counters, and optimistic UI contract needed by bookmarks.

### P1-2.2 Bookmarks

Implement private per-user saved targets and a protected `/me/bookmarks` page.

### P1-2.3 Views

Implement deduplicated views through a server-side RPC. Views are aggregate signals, not user-visible identity records.

### P1-2.4 Comments

Implement comments and one-level replies, then connect them to the P1-1.7 Moderation review workspace.

Each subphase must be independently deployable and forward-only.

## 4. Shared target model

Likes, bookmarks, and views can point to either a ranking or an item. A single polymorphic table with nullable foreign keys is safer than arbitrary `entity_type/entity_id` because PostgreSQL can enforce referential integrity.

Every interaction row must satisfy exactly one target:

```sql
CHECK (num_nonnulls(ranking_id, item_id) = 1)
```

No interaction may target draft, archived, blocked, or inactive content. Mutation RPCs re-check target visibility at write time.

## 5. Database design

### 5.1 `content_likes`

```sql
CREATE TABLE public.content_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ranking_id UUID REFERENCES public.rankings(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(ranking_id, item_id) = 1)
);

CREATE UNIQUE INDEX uq_content_likes_user_ranking
  ON public.content_likes(user_id, ranking_id)
  WHERE ranking_id IS NOT NULL;

CREATE UNIQUE INDEX uq_content_likes_user_item
  ON public.content_likes(user_id, item_id)
  WHERE item_id IS NOT NULL;
```

Semantics:

- one user can like one target once
- delete means unlike
- rows are not public profile activity
- anonymous users cannot mutate

### 5.2 `content_bookmarks`

```sql
CREATE TABLE public.content_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ranking_id UUID REFERENCES public.rankings(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(ranking_id, item_id) = 1)
);
```

Use the same partial uniqueness indexes as likes.

Bookmarks are strictly private to the owner. Admins do not require direct browsing access in P1-2.

### 5.3 `content_view_events`

```sql
CREATE TABLE public.content_view_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ranking_id UUID REFERENCES public.rankings(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  viewer_key_hash TEXT NOT NULL,
  viewed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  view_count INTEGER NOT NULL DEFAULT 1 CHECK (view_count >= 1),
  CHECK (num_nonnulls(ranking_id, item_id) = 1)
);
```

Unique indexes:

```sql
CREATE UNIQUE INDEX uq_content_view_ranking_day
  ON public.content_view_events(ranking_id, viewer_key_hash, viewed_on)
  WHERE ranking_id IS NOT NULL;

CREATE UNIQUE INDEX uq_content_view_item_day
  ON public.content_view_events(item_id, viewer_key_hash, viewed_on)
  WHERE item_id IS NOT NULL;
```

`viewer_key_hash` must be generated server-side from a rotating secret and a coarse identity source. Raw IP, full user agent, cookie value, or user ID must never be stored in this table.

Recommended input priority:

1. authenticated user ID
2. signed first-party anonymous viewer cookie
3. request-level fallback fingerprint only when neither exists

A daily unique view is counted once per target per `viewer_key_hash`. Repeated loads update `last_viewed_at` and increment diagnostic `view_count`, but aggregate unique views count rows, not `view_count`.

### 5.4 Counter strategy

Do not add mutable `like_count`, `bookmark_count`, or `view_count` columns directly to `rankings` and `items` in the first implementation.

Use aggregate SQL views/RPCs:

- `get_ranking_engagement(ranking_id)`
- `get_item_engagement(item_id)`
- `get_my_engagement_state(target)`

Reason:

- avoids trigger drift
- avoids counter corruption during deletes
- keeps the source of truth in interaction rows
- current traffic scale does not justify denormalized counters

If aggregate latency becomes measurable, introduce a separate materialized/cached projection in a later phase.

## 6. RPC design

All writes use fixed-name RPCs. The client must not directly insert/delete interaction rows.

### 6.1 Toggle like

```text
toggle_ranking_like(ranking_id)
toggle_item_like(item_id)
```

Transaction:

1. require authenticated user
2. lock/check target
3. verify public state
4. delete existing like or insert new like
5. return `{ liked, like_count }`

Use an advisory transaction lock derived from `(user_id, target_id, interaction_type)` or rely on the unique index plus retry-safe `INSERT ... ON CONFLICT` logic. The operation must be idempotent under double-clicks.

### 6.2 Toggle bookmark

```text
toggle_ranking_bookmark(ranking_id)
toggle_item_bookmark(item_id)
```

Return `{ bookmarked }`. Public aggregate bookmark counts are out of scope because bookmarks represent private intent and can create privacy-sensitive popularity signals.

### 6.3 Record view

```text
record_ranking_view(ranking_id, viewer_key_hash)
record_item_view(item_id, viewer_key_hash)
```

These functions must not trust a hash supplied directly by a browser. A Next.js server action or route handler creates the hash and calls the RPC with a server-held service path or authenticated database context.

The public client receives only aggregate counts.

### 6.4 Comment writes

```text
create_ranking_comment(ranking_id, body, parent_id?)
create_item_comment(item_id, body, parent_id?)
update_own_comment(comment_id, body)
delete_own_comment(comment_id)
```

Comment creation rules:

- authenticated only
- target must be publicly visible
- body length: 1 to 2,000 normalized characters
- exactly one of `ranking_id` or `item_id`
- reply parent must target the same ranking/item
- replies to replies are rejected; maximum depth is one
- server-side Moderation runs before insert
- `blocked` or `needs_review` comments are stored but not publicly rendered
- author can see their own pending comment with a status message

Comment update rules:

- author or admin only
- deleted comments cannot be edited
- body change resets Moderation status from prior manual approval to the newly evaluated automated result
- a new append-only automated Moderation review entry should be added when automated decisions are recorded in the common review ledger, or this should be explicitly deferred to P1-2.4.1

Comment delete rules:

- soft delete: `status = 'deleted'`, body replaced with an empty string or a fixed tombstone at query time
- preserve child replies and audit timestamps
- hard delete reserved for administrative/legal erasure procedures

## 7. Comment schema corrections

Add database constraints and indexes:

```sql
ALTER TABLE public.comments
  ADD CONSTRAINT comments_exactly_one_target
  CHECK (num_nonnulls(ranking_id, item_id) = 1);

ALTER TABLE public.comments
  ADD CONSTRAINT comments_body_length
  CHECK (char_length(body) BETWEEN 1 AND 2000);
```

Indexes:

```sql
CREATE INDEX idx_comments_ranking_public
  ON public.comments(ranking_id, created_at)
  WHERE ranking_id IS NOT NULL;

CREATE INDEX idx_comments_item_public
  ON public.comments(item_id, created_at)
  WHERE item_id IS NOT NULL;

CREATE INDEX idx_comments_parent
  ON public.comments(parent_id, created_at)
  WHERE parent_id IS NOT NULL;
```

Parent target and one-level-depth validation require a trigger or authoritative RPC validation; a plain CHECK constraint cannot reference another row.

## 8. RLS and privilege model

### Likes

- anon: no table access
- authenticated: no direct table write
- authenticated: may read only their own like state through RPC
- public: aggregate counts only through safe RPC

### Bookmarks

- anon: none
- authenticated: owner-only list through RPC or owner RLS
- no public aggregate count in P1-2

### View events

- anon/authenticated: no direct access
- server-only write path
- public aggregate counts through safe RPC

### Comments

Public SELECT condition:

```text
status = visible
AND moderation_status IN (clean, suggestive)
AND target is publicly visible
```

Authenticated users may additionally read their own `needs_review` comments. Internal review fields must not be exposed in public queries.

Direct writes are revoked. RPCs remain authoritative.

## 9. Application architecture

### Server modules

```text
src/lib/actions/engagement.ts
src/lib/actions/comments.ts
src/lib/queries/engagement.ts
src/lib/queries/comments.ts
src/lib/engagement/viewer-key.ts
```

### UI components

```text
src/components/engagement/LikeButton.tsx
src/components/engagement/BookmarkButton.tsx
src/components/engagement/EngagementSummary.tsx
src/components/comments/CommentComposer.tsx
src/components/comments/CommentList.tsx
src/components/comments/CommentRow.tsx
```

### Pages

- ranking detail: engagement summary, like, bookmark, views, ranking comments
- item detail: same target-specific controls and comments
- `/me/bookmarks`: authenticated private bookmark list

The existing public query module must keep explicit column selections. New public interaction queries must not reintroduce `select('*')`.

## 10. Authentication UX

Anonymous users can see aggregate like and view counts, but cannot see bookmark counts.

When an anonymous user presses like, bookmark, or comment:

1. preserve a validated relative `next` path
2. navigate to `/login?next=...`
3. after login, return to the content page

Do not execute the original action automatically after login in P1-2. This avoids replay ambiguity and CSRF-like surprise actions.

## 11. Optimistic UI contract

Like and bookmark buttons may update optimistically, but must:

- disable duplicate requests while pending
- restore previous state on RPC failure
- accept the RPC response as authoritative
- avoid deriving final counts solely from local increments

Comments should not use blind optimistic publication. Insert a pending local row only if it is clearly marked pending; the server response determines whether it is visible or awaiting review.

## 12. Abuse and operational controls

P1-2 must include minimal abuse controls:

- comment create: max 5 per minute and 30 per hour per user
- comment update: max 20 per hour per user
- like/bookmark toggle: max 60 per minute per user
- view recording: one unique row per target/viewer/day
- body normalization before length and Moderation checks

Rate limits should initially be database-enforced using recent-row checks inside the transaction. External rate-limit infrastructure is out of scope.

## 13. Privacy decisions

- likes are not exposed as a public user activity list
- bookmarks are private
- raw IP addresses are never persisted
- viewer hashes rotate with a daily or versioned server secret
- public APIs return aggregate counts only
- profile display name/avatar are exposed only with visible comments
- deleted comments retain author ID internally but public rendering uses a tombstone

## 14. API response contracts

### Engagement summary

```ts
type EngagementSummary = {
  likeCount: number
  uniqueViewCount: number
  likedByMe: boolean
  bookmarkedByMe: boolean
}
```

For anonymous users, `likedByMe` and `bookmarkedByMe` are false and must not imply an authenticated check occurred.

### Comment result

```ts
type CommentMutationResult = {
  success?: true
  commentId?: string
  visibility?: 'visible' | 'needs_review' | 'blocked'
  error?: string
  code?: 'AUTH_REQUIRED' | 'RATE_LIMITED' | 'INVALID_TARGET' | 'INVALID_PARENT' | 'CONTENT_REJECTED'
}
```

## 15. Migration order

1. `content_likes` plus indexes, RLS, fixed RPCs
2. `content_bookmarks` plus indexes, RLS, fixed RPCs
3. `content_view_events` plus server-only permissions and aggregate RPCs
4. comments constraints, indexes, reply validation, write RPCs, public-safe read policy
5. optional automated moderation audit integration after comment mutation flow is stable

Each migration must be forward-only and recorded through Supabase migration history. Do not use raw hosted DDL as the canonical path.

## 16. Verification matrix

### Likes

- anonymous mutation rejected
- authenticated first toggle creates one row
- second toggle removes it
- rapid double request does not create duplicates
- draft/archived/blocked target rejected
- ranking and item targets remain independent

### Bookmarks

- owner can add/remove/list
- another user cannot read bookmarks
- anon cannot read or mutate
- deleted target cascades bookmark cleanup

### Views

- first daily viewer-target request creates one unique row
- repeat same day does not increase unique count
- next day creates a new unique row
- no raw IP or user agent stored
- draft/blocked target ignored or rejected

### Comments

- exactly one target enforced
- parent target mismatch rejected
- reply-to-reply rejected
- unauthorized edit/delete rejected
- blocked/needs-review comment hidden from public
- author can see their pending comment
- visible comment joins only safe profile fields
- soft-deleted parent preserves reply thread
- edited comment is re-moderated

### Regression

- public internal fields remain inaccessible
- P1-1.6 ranking save transaction remains unchanged
- P1-1.7 review RPCs and append-only history remain intact
- lint and production build pass

## 17. Definition of Done

P1-2 is complete when:

- likes work for rankings and items with idempotent toggling
- bookmarks are private and available in `/me/bookmarks`
- unique daily views are recorded without raw personal identifiers
- comments and one-level replies work on rankings and items
- comment Moderation and admin review are integrated
- all writes use fixed RPCs
- public reads use explicit safe columns
- RLS and privilege tests pass
- hosted migration history contains every forward migration
- CI lint/build pass
- independent review finds no critical or high-severity issue
