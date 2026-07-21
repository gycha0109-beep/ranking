# P1-2.2 Bookmarks Review

## Result

Status: APPROVED

## Reviewed controls

- Bookmark rows reference exactly one ranking or item.
- User-target duplicates are prevented by partial unique indexes.
- Mutation RPCs accept explicit desired state and are idempotent.
- Per-user rate-limit checks and per-target writes are transactionally serialized.
- Ranking and item eligibility is locked and checked before mutation.
- Item bookmarks require reachability from a public ranking.
- Anonymous users cannot call bookmark mutations or listing RPCs.
- API roles cannot directly read or mutate bookmark tables.
- Bookmark counts and raw user activity are not exposed publicly.
- `list_my_bookmarks` derives identity only from `auth.uid()` and returns only the caller's bookmarks.
- Deleted ranking/item rows cascade bookmark cleanup.
- `/me/bookmarks` redirects anonymous users through a validated relative login return path.
- Ranking/item detail controls use optimistic state with server-authoritative rollback.

## Hosted verification

- Migration history application: PASS
- First bookmark request: changed=true
- Repeated identical request: changed=false
- Unset request: changed=true, bookmarked=false
- Ranking/item independent storage: PASS
- Anonymous table SELECT: denied
- Authenticated direct table INSERT: denied
- Anonymous mutation RPC: denied
- Anonymous list RPC: denied
- Authenticated fixed RPCs: allowed
- Smoke mutations executed inside transactions and rolled back

## Review notes

The initial manual migration invocation contained a truncated SQL fragment and failed before any schema change. The canonical migration file was then applied successfully through migration history. No partial objects were left by the failed transaction.

No critical or high-severity finding remains. Public bookmark counts remain intentionally out of scope.
