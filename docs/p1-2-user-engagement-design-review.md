# P1-2 User Engagement Design Review

## Review result

Status: **APPROVED WITH REQUIRED IMPLEMENTATION GATES**

The design is viable and compatible with the current P1-1.5 through P1-1.7 baselines. The following corrections and implementation gates are mandatory.

## 1. Corrected scope order

Implement as four separate PRs rather than one large PR:

1. P1-2.1 likes
2. P1-2.2 bookmarks
3. P1-2.3 unique views
4. P1-2.4 comments and replies

Reason: comments and views have materially different abuse, privacy, Moderation, and operational risks. Combining all four would make rollback and independent review too broad.

## 2. Likes and bookmarks must not share one generic write RPC

A generic `toggle_interaction(type, entity_type, entity_id)` would reduce code volume but increase authorization and target-validation risk.

Required fixed functions:

- `toggle_ranking_like`
- `toggle_item_like`
- `toggle_ranking_bookmark`
- `toggle_item_bookmark`

The same rule applies to aggregate reads. Dynamic table names or dynamic SQL are prohibited.

## 3. Toggle semantics require serialization

A pure read-then-insert/delete toggle can race when the same user double-clicks or submits from two tabs.

Required database control:

- acquire `pg_advisory_xact_lock` derived from user, target, and interaction type; or
- use an equivalent serialized state-transition function whose concurrent behavior is proven by a test

A uniqueness constraint alone prevents duplicates but does not guarantee the intended final toggle state.

## 4. Public content eligibility must be centralized

Every mutation function must use the same eligibility rules:

### Ranking

- `status = 'published'`
- text Moderation is `clean` or `suggestive`
- image Moderation is `clean` or `suggestive`

### Item

- `status = 'active'`
- text Moderation is `clean` or `suggestive`
- image Moderation is `clean` or `suggestive`
- item must be reachable from at least one published ranking, unless standalone public items become an explicit product decision

This should be implemented as private helper functions, not copied inconsistently across RPCs.

## 5. Bookmark privacy is stricter than ordinary RLS

Required controls:

- revoke direct SELECT/INSERT/UPDATE/DELETE from anon
- authenticated direct SELECT may be allowed only with owner RLS, but RPC-only reads are preferred for consistency
- public APIs must not return aggregate bookmark counts
- admin access is not automatically granted in P1-2

## 6. View fingerprint correction

Do not build the hash from IP and user agent alone. NAT and shared devices would merge unrelated users; small populations can also make hashes guessable.

Required approach:

- authenticated: hash stable user ID with a rotating server secret and date bucket
- anonymous: issue a signed, random first-party viewer token; hash token with secret and date bucket
- no raw token, IP, or user agent stored in PostgreSQL
- IP may be used only transiently for abuse filtering and must not be included unless privacy review explicitly approves it

The viewer hash must be produced in trusted server code. Supabase anon RPCs must not accept arbitrary browser-generated hashes as authoritative.

## 7. View event retention

`content_view_events` will grow continuously.

Required initial retention policy:

- retain daily unique rows for 13 months
- document a scheduled deletion job before production volume grows
- deletion must not affect immutable editorial evidence or Moderation history

The first implementation may ship without an active scheduler only if the retention SQL and operational follow-up are documented.

## 8. Comment storage policy correction

Blocked comments should not be publicly rendered, but storing illegal, privacy-invasive, or highly sensitive content indefinitely may create unnecessary risk.

Required handling:

- `needs_review`: retain full body for review
- `blocked`: retain body for a limited moderation window, then redact according to a later retention job
- privacy or illegal-content categories may require immediate restricted handling
- public query never exposes blocked body

P1-2.4 must document the initial retention policy even if automated redaction is deferred.

## 9. Comment delete representation

Do not overwrite the stored body with an empty string because the current table requires a non-empty body constraint and moderation/legal review may need the original.

Required design:

- keep original body internally
- set `status = 'deleted'`
- public query returns a generated tombstone and excludes the stored body
- author and public users cannot retrieve deleted body
- admin/legal retrieval is a separate privileged path, not part of public comment queries

## 10. Comment depth and target validation must be database-authoritative

The RPC must lock/read the parent and verify:

- parent exists
- parent is not deleted or hidden when new replies are disallowed
- parent targets the same ranking or item
- parent has no parent itself

UI validation alone is insufficient.

## 11. Comment edit concurrency

Comment updates need an optimistic concurrency token.

Required signature:

```text
update_own_comment(comment_id, expected_updated_at, body)
```

The update must fail with a conflict code when `updated_at` differs. This avoids the stale-tab limitation already documented for the ranking editor.

## 12. Automated Moderation audit decision

P1-1.7 introduced append-only `moderation_reviews`. Comment creation and editing must not silently change Moderation state without audit evidence.

Required for P1-2.4:

- insert an automated review record for initial comment moderation
- insert another automated review record when an edit changes or re-evaluates the comment
- set `decision_source = 'automated'`
- include matched rule metadata where available

Manual admin decisions continue through the existing `review_comment_moderation` RPC.

## 13. Rate-limit implementation gate

Counting arbitrary recent rows inside every transaction may degrade as tables grow.

Acceptable first implementation:

- indexed query on `(user_id, created_at)` for comments and interactions
- bounded lookback window
- `statement_timeout` protection
- explicit tests for rate-limit boundary behavior

Do not create a broad global rate-limit table in P1-2 unless the repeated pattern justifies it after P1-2.1.

## 14. Aggregate-query performance gate

Before denormalizing counters, add and verify target indexes:

- likes by ranking and item
- views by ranking and item/date
- comments by target/status/moderation/created_at

Use `EXPLAIN` on representative aggregate queries. Denormalized counters remain deferred unless query plans demonstrate need.

## 15. Public query safety gate

All new public queries must enumerate columns.

Forbidden:

```text
select('*')
profiles(*)
comments(*)
```

Visible comment profile projection is limited to:

- `display_name`
- `avatar_url`

No email, role, internal Moderation note, reviewer identity, or hidden body may cross the public boundary.

## 16. Required implementation evidence per subphase

Each PR must include:

- forward-only migration file
- migration-history confirmation
- RLS/privilege verification query
- authenticated positive test
- anonymous negative test
- duplicate/concurrency test
- target-visibility rejection test
- rollback or disposable-fixture cleanup evidence
- lint and production build
- independent review document

## 17. Final design decision

P1-2 is approved with this execution sequence:

```text
P1-2.1 Likes
→ independent review and hosted DB verification
→ P1-2.2 Bookmarks
→ privacy review and owner-isolation verification
→ P1-2.3 Unique Views
→ privacy/retention verification
→ P1-2.4 Comments
→ Moderation, concurrency, deletion, and abuse verification
```

The immediate implementation target is **P1-2.1 Likes only**. No bookmark, view, or comment production code should be mixed into that first PR.
