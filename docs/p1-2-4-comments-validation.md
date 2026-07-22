# P1-2.4 Comments and Replies Validation

## Baseline

- Base main: `953f4039d3e396b299e85e16ed1a3230e7e2ad29`
- Branch: `feat/p1-2-4-comments`
- Hosted Supabase project: `yjdubukqkcvkymabskzd`

## Hosted migrations

Applied successfully:

- `p1_2_4_comments_schema`
- `p1_2_4_comment_write_rpcs`
- `p1_2_4_comment_read_rpcs`
- `p1_2_4_comment_retention`
- `p1_2_4_comment_review_hardening`

## Permission validation

- anon direct `comments` SELECT: denied
- authenticated direct `comments` INSERT: denied
- anon create-comment RPC: denied
- authenticated create-comment RPC: allowed
- anon public-list RPC: allowed
- authenticated admin-queue RPC entry point: allowed, with in-function admin authorization
- anon blocked-body redaction RPC: denied
- service role blocked-body redaction RPC: allowed

## Functional validation

Validated against a published ranking and public item:

- clean root comment created as visible
- one-level reply created as visible
- nested reply rejected with SQLSTATE `22023`
- cross-target parent mismatch rejected with SQLSTATE `22023`
- automated `needs_review` classification stored as hidden
- automated `blocked` classification stored as hidden
- anonymous list returned only public-safe visible rows
- owner list returned own pending row and replaced blocked body with a policy placeholder
- public comment count included only visible clean/suggestive comments
- owner edit succeeded and updated optimistic-concurrency timestamp
- stale edit rejected with SQLSTATE `40001`
- non-owner edit rejected with SQLSTATE `42501`
- root deletion produced a tombstone while preserving the visible reply thread
- admin queue exposed target slug/title and pending/blocked rows
- admin manual review changed lifecycle visibility and public count
- 30-day blocked-body retention redacted body while preserving row lifecycle and Moderation state

## Cleanup

- All temporary comment rows and mutation-event rows were removed.
- Moderation review records are append-only by design; smoke-review evidence remains in the immutable Moderation ledger.

## Remaining gate

- GitHub exact-head CI: lint and production build
- PR merge remains prohibited until explicit approval
