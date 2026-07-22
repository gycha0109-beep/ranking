# P1-2.4 Comments and Replies Design

## 1. Goal

Add authenticated ranking and item comments with one-level replies without weakening the existing public-content, Moderation, audit, privacy, and transactional baselines.

P1-2.4 includes:

- ranking comments
- item comments
- one-level replies
- create, edit, and soft-delete flows
- public-safe cursor pagination
- author visibility for comments awaiting review
- automated Moderation decisions and append-only audit records
- manual admin review through the existing comment Moderation RPC
- minimal abuse controls
- blocked-body retention and redaction control

It does not include reactions on comments, notifications, mentions, rich text, Markdown rendering, file attachments, reputation, or unlimited reply depth.

## 2. Existing baseline

The current database already has `comments` with:

- exactly one ranking or item target
- optional `parent_id`
- author profile foreign key
- lifecycle status: `visible`, `hidden`, `deleted`
- text Moderation state and reason
- review metadata
- `updated_at` trigger

The current table has no production rows, so constraints and privilege corrections can be added without data repair.

Existing Moderation infrastructure provides:

- `moderation_terms`
- append-only `moderation_reviews`
- `review_comment_moderation`
- admin identity through `public.is_admin()`

## 3. Comment semantics

### Root comment

A root comment has `parent_id IS NULL` and targets one public ranking or one public item.

### Reply

A reply has one root parent. The database rejects:

- missing parent
- parent on another target
- reply to a reply
- reply to hidden, deleted, blocked, or pending parent

Maximum depth is one.

### Lifecycle

- `visible`: publicly renderable when Moderation is `clean` or `suggestive`
- `hidden`: retained but not publicly renderable; used for `needs_review` and `blocked`
- `deleted`: author soft deletion; original body remains restricted internally

A deleted root remains as a tombstone when it has replies. Deleted replies may also render as tombstones to preserve sequence.

## 4. Body contract

- plain text only
- normalized with Unicode NFKC in trusted server code
- database additionally trims and collapses repeated whitespace
- length after normalization: 1 to 2,000 characters
- HTML is never rendered as markup
- empty or whitespace-only bodies are rejected

## 5. Database hardening

Add:

- named body-length constraint
- `deleted_at`
- `body_redacted_at`
- target/status/created cursor indexes
- parent/created index
- author/mutation-time index
- private mutation-event table for bounded rate checks

Direct API-role access to comment bodies is removed. Ordinary public and authenticated reads use fixed RPCs only. Authenticated table SELECT remains available only to admins through RLS for the Moderation workspace.

## 6. Automated Moderation

A private database function evaluates normalized text against enabled `moderation_terms`.

Mapping:

- `block` severity -> `blocked`
- `review` with category `sexual_suggestive` -> `suggestive`
- other `review` categories -> `needs_review`
- no match -> `clean`

Priority:

```text
blocked > needs_review > suggestive > clean
```

Creation and edit each append one `moderation_reviews` row with:

- `entity_type = comment`
- `decision_source = automated`
- previous and new Moderation state
- matched term ID where available
- metadata identifying create or edit

Automated decisions never set a human reviewer identity.

## 7. Mutation RPCs

Fixed public wrappers:

```text
create_ranking_comment(ranking_id, body, parent_id?)
create_item_comment(item_id, body, parent_id?)
update_own_comment(comment_id, expected_updated_at, body)
delete_own_comment(comment_id, expected_updated_at)
```

All are authenticated-only and use `auth.uid()` as author identity.

### Creation

1. require authenticated profile
2. normalize and validate body
3. lock and verify public target
4. serialize per-user rate boundary
5. enforce 5 creates/minute and 30 creates/hour
6. if replying, lock and validate parent and depth
7. evaluate Moderation
8. insert comment
9. append automated review
10. append mutation event
11. return ID, state, and authoritative timestamps

### Edit

1. require author ownership
2. lock row
3. reject deleted comment
4. require exact `expected_updated_at`
5. enforce 20 updates/hour
6. re-evaluate Moderation
7. clear stale manual review metadata
8. update body and visibility
9. append automated review and mutation event

A timestamp mismatch raises a conflict and preserves the stored row.

### Delete

1. require author ownership
2. lock row
3. require exact `expected_updated_at`
4. set `status = deleted` and `deleted_at`
5. preserve original body internally
6. append mutation event

Repeated deletion returns the existing deleted state without exposing the body.

## 8. Public read RPCs

Fixed wrappers:

```text
list_ranking_comments(ranking_id, cursor_created_at?, cursor_id?, limit?)
list_item_comments(item_id, cursor_created_at?, cursor_id?, limit?)
```

Return a JSON object containing:

- selected root threads
- one-level replies
- next root cursor
- caller authentication state

Cursor order:

```text
root created_at DESC, root id DESC
```

Replies are ordered oldest first inside each root.

Public output exposes only:

- comment IDs and parent IDs
- generated display body
- lifecycle presentation status
- created/updated timestamps
- `edited` flag
- `is_mine`
- profile `display_name` and `avatar_url`

It never exposes:

- email
- role
- raw blocked or deleted body
- Moderation reason or review note
- reviewer identity
- mutation audit rows

Visible comments are returned to everyone. The authenticated author additionally receives their own `needs_review` row with its body and a pending state. Own blocked and deleted rows receive generated status text rather than the stored body.

## 9. Target eligibility

Ranking:

- published
- text Moderation clean or suggestive
- image Moderation clean or suggestive

Item:

- active
- text and image Moderation clean or suggestive
- reachable through an eligible published ranking entry

Target rows and item reachability rows are share-locked during creation.

## 10. Manual Moderation integration

The existing `review_comment_moderation` remains the sole manual decision function.

A comment Moderation queue is added under `/admin/comments` and shows:

- comment body for privileged reviewers
- author display name
- target type and target title
- current status and reason
- created timestamp
- previous review history

Manual clean or suggestive decisions make non-deleted comments visible. Manual needs-review or blocked decisions hide them. The existing append-only review ledger records the decision.

## 11. Abuse controls

- create: 5/minute and 30/hour/user
- update: 20/hour/user
- delete: 30/hour/user
- advisory transaction lock serializes each user rate boundary
- mutation events are private
- lookup index: `(user_id, event_type, created_at DESC)`
- database functions use a local statement timeout

External CAPTCHA, distributed rate limiting, bot scoring, and network fingerprinting remain out of scope.

## 12. Retention

- visible and needs-review comment bodies are retained
- blocked bodies are retained for 30 days for restricted review
- a service-role-only bounded purge function redacts blocked bodies after the window
- redaction replaces body with an internal fixed marker and sets `body_redacted_at`
- public output never returns the restricted marker or original blocked body
- deleted bodies are not automatically redacted in this phase because legal erasure and thread preservation need a separate policy

Purge function:

```text
redact_expired_blocked_comment_bodies(batch_size <= 1000)
```

Recommended cadence: daily until zero rows are returned.

## 13. Application architecture

New modules:

```text
src/lib/actions/comments.ts
src/components/comments/CommentSection.tsx
src/app/admin/comments/page.tsx
src/app/admin/comments/CommentModerationQueue.tsx
```

Ranking and item detail pages mount the same `CommentSection` with an explicit target type, target ID, and canonical pathname.

The component:

- loads the first page
- creates root comments and replies
- edits with the current `updated_at` concurrency token
- soft-deletes with confirmation
- redirects anonymous composers to validated login return path
- does not optimistically publish Moderation-sensitive content
- reloads authoritative server results after mutations

## 14. Failure behavior

- anonymous mutation -> `AUTH_REQUIRED`
- invalid target -> no write
- invalid parent or reply depth -> no write
- stale edit/delete -> `CONFLICT`
- rate limit -> `RATE_LIMITED`
- needs-review/blocked create -> success with non-public status
- list failure -> comments section remains isolated from the rest of the detail page

## 15. Verification matrix

### Schema and privileges

- exactly one target remains enforced
- body length constraint passes boundaries and rejects invalid values
- ordinary API roles cannot directly SELECT or mutate comments
- ordinary API roles cannot read mutation events
- anon and authenticated can execute only appropriate fixed RPCs
- service role only can execute blocked-body redaction

### Creation and replies

- root ranking comment
- root item comment
- valid one-level reply
- target-mismatched parent rejected
- reply-to-reply rejected
- deleted or hidden parent rejected
- draft/non-public targets rejected

### Moderation

- clean create visible
- suggestive create visible with automated review
- needs-review create hidden publicly and visible to author as pending
- blocked create hidden and body absent from public RPC
- edit creates a second automated review
- manual review updates lifecycle visibility and appends history

### Concurrency and authorization

- another user cannot edit/delete
- stale `updated_at` edit rejected
- stale delete rejected
- deleted comment cannot be edited
- deleted body cannot be retrieved through public/author RPC

### Pagination

- root cursor has no duplicate or missing root across pages
- replies stay attached to their selected roots
- deleted parent tombstone preserves visible replies

### Retention

- expired blocked body redacted
- non-expired and non-blocked bodies unchanged
- purge bounded by requested batch size

### Regression

- likes, bookmarks, and views unchanged
- ranking/item public data projections unchanged
- existing manual Moderation functions still work
- lint and production build pass

## 16. Definition of Done

P1-2.4 is complete when all comment mutations, replies, Moderation audit, public-safe reads, admin review, concurrency checks, retention control, hosted verification, independent review, and exact-head CI pass with no unresolved critical or high-severity finding.
