# P1-2.3 Daily Unique Views Design Review

## Result

Status: **APPROVED WITH REQUIRED CORRECTIONS**

The privacy boundary and server-authoritative identity model are suitable. The following corrections are mandatory before implementation.

## 1. Retention must not reduce public lifetime counts

The initial design reads aggregate counts directly from retained daily event rows. Deleting events after 13 months would therefore make public counts decrease.

Required correction:

- add a private `content_view_totals` table
- increment the total only when a new daily event row is inserted
- keep total update and event insert in the same transaction
- read public counts from the cumulative total table
- purge only daily deduplication rows, never cumulative totals

Schema shape:

```text
content_view_totals
- ranking_id or item_id, exactly one
- unique_view_count bigint, non-negative
- updated_at
- one total row per target
```

This makes the displayed count lifetime-cumulative while retaining daily viewer hashes for only 13 months.

## 2. Count mutation must depend on actual insertion

`INSERT ... ON CONFLICT DO NOTHING` must capture whether a row was inserted.

Required pattern:

```text
INSERT ... ON CONFLICT DO NOTHING RETURNING id
```

Increment `content_view_totals` only when `RETURNING` produced a row. Repeated effects, refreshes, and concurrent calls must not increase the total.

## 3. UTC date is database-authoritative

The trusted write RPC must reject any `viewed_on` value other than `(now() AT TIME ZONE 'UTC')::date`.

The application may calculate the same date for HMAC input, but the database independently enforces the current UTC bucket.

A request crossing midnight may fail once due to date mismatch. The server action should retry exactly once using a newly derived UTC bucket.

## 4. Viewer hashes require domain separation

The HMAC input must include all of:

```text
ranking-wiki-view:v1
UTC date
identity kind: user or anonymous
identity value
```

This prevents the same secret from producing reusable keys for unrelated future features.

## 5. Dedicated secret remains the production requirement

Using `SUPABASE_SERVICE_ROLE_KEY` as a temporary fallback is acceptable only for compatibility with the current deployment baseline.

Required controls:

- code reads secrets server-side only
- no secret is prefixed `NEXT_PUBLIC_`
- documentation marks `VIEWER_HASH_SECRET` as required for production hardening
- CI may use the existing service-role placeholder
- no secret or derived identity appears in logs or action responses

## 6. Anonymous token semantics must be stated accurately

The metric is not a guaranteed unique human count.

It represents:

- one authenticated account per target/day, or
- one anonymous browser token per target/day

Clearing cookies or using multiple browsers can produce additional counts. IP/user-agent fingerprinting is intentionally rejected to avoid collecting invasive identifiers.

## 7. Raw event and total tables are both private

Required privilege model:

- `content_daily_views`: no anon/authenticated table privileges
- `content_view_totals`: no anon/authenticated table privileges
- write RPCs: service role only
- purge RPC: service role only
- count RPCs: anon/authenticated execute only
- no generic entity-type RPC and no dynamic SQL

## 8. Target validation must be duplicated at the database boundary

The application path-to-ID check is necessary but not sufficient.

The database write RPC must lock and revalidate:

- ranking status and both Moderation states
- item status and both Moderation states
- item reachability through an eligible ranking entry and ranking

The event insert and total increment occur after the target lock is acquired.

## 9. Application recording should not block interaction loading

The current engagement dock loads likes and bookmarks through `getEngagementTargetByPath`.

Required implementation:

- include the current aggregate view count in the initial engagement target response
- invoke a separate `recordContentView` effect after target resolution
- update only the count from the recording result
- a recording error must not hide or disable likes/bookmarks
- avoid repeated error banners for passive view-recording failures

The component may remain named `LikeDock` in this phase to minimize unrelated file churn, but `EngagementDock` is the preferred later cleanup.

## 10. Retention operation must be bounded

A single unbounded delete can become expensive.

Required purge function:

- accepts a bounded batch size with a safe maximum
- deletes oldest eligible rows first
- returns deleted count
- can be called repeatedly by a scheduler

Suggested maximum batch: 10,000 rows.

## 11. Verification additions

In addition to the initial matrix, implementation verification must prove:

- cumulative total remains unchanged when old event rows are purged
- duplicate same-day requests do not increment totals
- two different viewer hashes increment totals twice
- ranking and item totals remain independent
- browser roles cannot read the cumulative total table
- browser roles cannot call write or purge RPCs
- malformed HMAC and non-current date are rejected
- raw cookie/user ID values are absent from event rows
- target-ID/path mismatch is rejected before service-role invocation

## 12. Final decision

Implementation is approved with this corrected model:

```text
trusted server identity
→ daily HMAC
→ service-role fixed RPC
→ private daily dedup row
→ transactional cumulative total increment only on insert
→ public aggregate count RPC
→ bounded 13-month event purge
```

No implementation should ship with event-row counting as the public lifetime count source.
