# P1-2.4 Comments and Replies Design Review

## Result

Status: **APPROVED WITH REQUIRED IMPLEMENTATION GATES**

The proposed one-level thread model is compatible with the existing `comments`, Moderation, profile, and public-content baselines. The following controls are mandatory.

## 1. Direct self-management policy must be removed

The existing `Comments manageable by self` table policy permits direct authenticated table operations and can expose stored deleted or blocked bodies to their author.

Required correction:

- revoke direct comments-table access from anon and ordinary authenticated users
- remove the broad self-management policy
- retain admin-only table SELECT through RLS
- route all ordinary reads and mutations through fixed RPCs

## 2. Public table reads must be replaced, not supplemented

The current anon grant includes the raw `body` column. Even though its RLS predicate currently filters Moderation states, future policy drift could expose restricted bodies.

Required correction:

- revoke anon table SELECT entirely
- return generated tombstones and pending states through fixed list RPCs
- enumerate every output field

## 3. Moderation must remain database-authoritative

A browser or ordinary RPC caller must not provide `moderation_status`, `moderation_reason`, or `matched_term_id`.

Required correction:

- evaluate enabled terms inside a private database function
- fixed create/edit RPCs accept body only
- append automated `moderation_reviews` in the same transaction
- fail the mutation if the audit row cannot be written

## 4. Manual review must synchronize lifecycle status

The existing generic review function updates comment Moderation fields but does not change `comments.status`.

Required correction:

- add a narrowly scoped comment trigger or update path
- non-deleted clean/suggestive comments become `visible`
- non-deleted needs-review/blocked comments become `hidden`
- deleted comments remain deleted regardless of later Moderation writes

## 5. Deleted-body confidentiality must be explicit

Keeping the original body internally is acceptable for audit, but neither public callers nor the author may retrieve it after deletion.

Required correction:

- list RPC uses a generated tombstone
- direct self SELECT is removed
- mutation return payloads never include the stored body after deletion
- admin/legal body access remains privileged and outside ordinary RPCs

## 6. Cursor pagination applies to roots only

Applying the cursor to the entire flat comment set can split a thread across pages.

Required correction:

1. select root IDs with the cursor and limit
2. fetch all eligible one-level replies for those roots
3. order roots newest first and replies oldest first
4. calculate the next cursor from the selected root page

## 7. Profile projection must not use relationship wildcards

Required public fields are only:

- `display_name`
- `avatar_url`

No profile ID beyond the comment author comparison, email, role, timestamps, or other profile metadata may appear in the output.

## 8. Parent checks require locks

The parent must be share-locked before the reply is inserted. The RPC must verify same target, root depth, visible lifecycle, and allowed Moderation state under that lock.

## 9. Rate checks must be serialized and indexed

Required:

- private mutation event table
- index on user, event type, timestamp
- advisory transaction lock per user before counting
- bounded lookback only
- local statement timeout

The create boundary is both 5/minute and 30/hour. Updates are limited to 20/hour.

## 10. Optimistic concurrency applies to delete as well

The base requirement explicitly covers edits. Delete should also require the displayed `updated_at` value so a stale tab cannot silently delete a newly edited comment.

Required signature:

```text
delete_own_comment(comment_id, expected_updated_at)
```

## 11. Blocked-body redaction must not break constraints or audit

Required:

- use a non-empty internal marker that passes the body constraint
- set `body_redacted_at`
- never alter `moderation_reviews`
- process at most 1,000 rows per call
- service-role execute only

## 12. UI must not claim publication before Moderation result

Comments are not optimistically inserted as visible. The server response controls the message:

- visible
- awaiting review
- blocked

The list is then reloaded from the authoritative read RPC.

## 13. Admin queue requires a dedicated privileged query

Do not reuse the public list RPC for Moderation. The admin queue requires restricted body, reason, target label, and history fields and therefore must verify admin role before querying.

## 14. Implementation split

Use forward-only migrations in this order:

1. schema, privileges, indexes, mutation events, lifecycle trigger
2. Moderation evaluation and fixed mutation/read RPCs
3. bounded blocked-body redaction
4. review hardening migration if implementation review finds a database issue

## 15. Approval decision

Implementation may proceed when every gate above is reflected in the migration and application code. No public comment feature may rely on direct table SELECT or browser-provided Moderation state.
