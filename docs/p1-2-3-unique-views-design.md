# P1-2.3 Daily Unique Views Design

## 1. Goal

Record one unique view per viewer, target, and UTC day for public rankings and public items while preserving the existing public-data, Moderation, and interaction privacy baselines.

P1-2.3 adds:

- daily unique ranking views
- daily unique item views
- public aggregate view counts
- server-side anonymous viewer identity
- authenticated viewer identity
- 13-month event retention controls
- detail-page view recording and display

It does not add real-time analytics dashboards, per-user viewing history, referrer tracking, geographic analytics, IP retention, user-agent fingerprinting, or recommendation features.

## 2. Core semantics

A unique view is defined as:

```text
one eligible target + one trusted viewer key + one UTC date
```

Repeated loads of the same target by the same viewer on the same UTC date do not create additional rows and do not increase the public count.

A view is recorded only after the public detail page resolves a currently eligible target.

## 3. Viewer identity

### Authenticated viewer

Use the authenticated Supabase user ID as the identity input.

### Anonymous viewer

Issue a random first-party token in an HttpOnly cookie:

```text
rw_viewer_v1
```

Cookie controls:

- HttpOnly
- SameSite=Lax
- Secure in production
- path `/`
- maximum age 400 days
- random UUID value

The raw cookie value is never sent to PostgreSQL.

### Daily pseudonymous key

Trusted server code derives:

```text
HMAC-SHA256(secret, version + UTC-date + identity-kind + identity-value)
```

The database receives only the 64-character hexadecimal HMAC.

Secret resolution order:

1. `VIEWER_HASH_SECRET`
2. `SUPABASE_SERVICE_ROLE_KEY` as a temporary server-only fallback

Production should configure a dedicated `VIEWER_HASH_SECRET` before the fallback is removed in a later hardening phase.

No raw IP address, user agent, referrer, email, anonymous token, or user ID is persisted in the view table.

## 4. Database model

```sql
CREATE TABLE public.content_daily_views (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ranking_id UUID REFERENCES public.rankings(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  viewer_key_hash TEXT NOT NULL,
  viewed_on DATE NOT NULL,
  key_version SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(ranking_id, item_id) = 1),
  CHECK (viewer_key_hash ~ '^[0-9a-f]{64}$'),
  CHECK (key_version >= 1)
);
```

Partial unique indexes:

```sql
UNIQUE (ranking_id, viewer_key_hash, viewed_on)
WHERE ranking_id IS NOT NULL

UNIQUE (item_id, viewer_key_hash, viewed_on)
WHERE item_id IS NOT NULL
```

Aggregate indexes:

```sql
(ranking_id, viewed_on)
(item_id, viewed_on)
```

## 5. Database functions

### Trusted write RPCs

```text
record_ranking_daily_view(ranking_id, viewer_key_hash, viewed_on, key_version)
record_item_daily_view(item_id, viewer_key_hash, viewed_on, key_version)
```

Privileges:

- executable by `service_role` only
- not executable by `anon` or `authenticated`
- no direct table access for API roles

Each function:

1. validates hash format, date boundary, and key version
2. locks and rechecks target eligibility
3. inserts with `ON CONFLICT DO NOTHING`
4. returns `{ inserted, unique_view_count }`

The supplied date must equal the database UTC date. Browsers cannot choose historical or future buckets.

### Public read RPCs

```text
get_ranking_unique_view_count(ranking_id)
get_item_unique_view_count(item_id)
```

Privileges:

- executable by `anon` and `authenticated`
- returns aggregate count only
- validates current target eligibility

### Retention RPC

```text
purge_expired_content_daily_views()
```

- executable by `service_role` only
- deletes rows older than 13 months
- returns deleted row count
- scheduler activation may be deferred, but the operation and runbook must exist

## 6. Target eligibility

Ranking view eligibility:

- `status = 'published'`
- text Moderation in `clean`, `suggestive`
- image Moderation in `clean`, `suggestive`

Item view eligibility:

- `status = 'active'`
- text Moderation in `clean`, `suggestive`
- image Moderation in `clean`, `suggestive`
- reachable through at least one public ranking entry

The write RPC locks the target row during validation to prevent a view from being inserted while the target transitions to a non-public state.

## 7. Application flow

### Server action

```text
recordContentView({ targetType, targetId, pathname })
```

Flow:

1. validate pathname shape
2. resolve slug and verify it maps to the supplied target ID
3. resolve authenticated user or anonymous viewer cookie
4. derive the daily HMAC server-side
5. call the service-role-only fixed RPC
6. return authoritative aggregate count

The server action never accepts a viewer hash from the browser.

### Detail-page component

The existing engagement dock records the view once when a ranking/item target loads.

UI behavior:

- shows an Eye icon and aggregate unique view count
- does not expose viewer identity
- updates with the RPC-returned count
- recording failure does not block page rendering or likes/bookmarks
- repeated React effects or refreshes remain deduplicated by the database unique index

## 8. Failure behavior

- invalid path or target mismatch: no write
- missing server secret: no write, controlled error
- unavailable service role: no write, controlled error
- non-public target: no write
- duplicate same-day view: success with `inserted = false`
- database failure: page remains usable; view count remains last known aggregate

## 9. Privacy and security boundary

- browser cannot submit authoritative hashes
- browser cannot call write RPCs
- raw activity rows are not publicly queryable
- public count functions return aggregate integers only
- viewer hashes rotate daily because the date is part of the HMAC input
- the same anonymous token cannot be correlated across dates using stored hashes alone
- authenticated IDs are never persisted in the view table
- no public or admin per-view history UI is added

## 10. Retention

Daily event rows are retained for 13 months.

Operational command:

```sql
SELECT public.purge_expired_content_daily_views();
```

Recommended cadence: once per day.

P1-2.3 ships the purge function and documentation. Activating an external scheduler is not required for the first deployment if the project has no scheduler baseline yet.

## 11. Verification matrix

### Database

- exactly one target constraint
- malformed hash rejected
- browser roles cannot read raw rows
- browser roles cannot invoke write RPCs
- service role can invoke fixed write RPCs
- first daily view inserts one row
- repeat same day returns `inserted=false`
- different viewer hash creates another row
- next UTC date creates another row
- ranking and item counts remain independent
- draft/inactive/Moderation-blocked target rejected
- deletion cascades event cleanup
- retention function deletes only rows older than 13 months

### Application

- ranking page records and displays count
- item page records and displays count
- anonymous viewer receives secure first-party cookie
- authenticated viewer uses user identity input
- raw viewer value never crosses the trusted server boundary
- malformed pathname and target mismatch rejected
- missing secret returns controlled failure

### Regression

- likes remain functional
- bookmarks remain private and functional
- public content queries remain explicit
- Moderation gates remain unchanged
- lint passes
- production build passes

## 12. Definition of Done

P1-2.3 is complete when:

- daily unique ranking and item views are recorded
- duplicate same-day views do not increase counts
- anonymous and authenticated identities are converted to server-derived daily HMACs
- no raw IP, user agent, token, or user ID is persisted
- raw event rows and write RPCs are inaccessible to browser roles
- aggregate counts are publicly readable
- 13-month purge control exists and is documented
- hosted migration history is current
- hosted transactional smoke tests pass and roll back
- independent implementation review has no unresolved critical/high finding
- final CI lint and production build pass
