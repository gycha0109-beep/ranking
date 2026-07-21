# P1-2.1 Likes Independent Review

## Result

Status: **PASS after corrections**

## Implemented

- Ranking likes and item likes use separate fixed RPCs.
- The write contract accepts an explicit desired state instead of a blind toggle.
- Raw like rows and request events are inaccessible to anon and authenticated clients.
- Public callers can read only aggregate count; authenticated callers also receive their own state.
- Non-public rankings and items not reachable from a public ranking are rejected.
- Ranking and item likes remain independent.
- A shared detail-page LikeDock provides optimistic UI, authoritative server reconciliation, rollback on failure, and login redirect for anonymous users.

## Findings corrected during review

1. The first action return type formed an unsafe TypeScript union and failed the production build. Explicit result contracts were added.
2. Path decoding and cache revalidation accepted a broader input than necessary. Exact ranking/item detail paths are now parsed and validated server-side.
3. The first database function counted rate-limit events before serialization. A per-user advisory lock now serializes the rate-limit boundary.
4. Initial eligibility checks did not retain locks on the target rows. Ranking, item, entry, and containing-ranking rows are now share-locked through the state change, preventing publication or Moderation state changes from racing the insert.
5. Blind toggling was rejected because two identical retries can invert state. `set_ranking_like` and `set_item_like` are idempotent desired-state operations.

## Hosted database verification

- Migration history records:
  - `p1_2_1_content_likes`
  - `p1_2_1_likes_review_hardening`
  - `p1_2_1_likes_target_lock_hardening`
- First `liked=true` request returned `changed=true`, count 1.
- Repeated `liked=true` returned `changed=false`, count 1.
- Ranking and item requests independently returned count 1.
- Anonymous write execution was rejected.
- Draft ranking mutation was rejected.
- Raw table SELECT/INSERT privileges remain denied to API roles.
- All state-changing smoke tests ran inside transactions and rolled back.

## Residual risks

- `content_like_events` needs an operational retention job before sustained high traffic. It currently exists only for the bounded one-minute rate-limit window and audit diagnosis.
- Aggregate counts are computed from source rows. This is intentional for correctness at current scale; cached projections can be introduced after query-plan evidence demonstrates need.
