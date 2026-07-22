# P1-2.3 Daily Unique Views Operations

## Required server configuration

Preferred production variable:

```text
VIEWER_HASH_SECRET=<at least 32 random bytes>
```

The value must be:

- server-only
- absent from client bundles
- absent from logs
- different from public Supabase keys
- generated from a cryptographically secure random source

The implementation temporarily falls back to `SUPABASE_SERVICE_ROLE_KEY` when `VIEWER_HASH_SECRET` is absent. This preserves compatibility with the current deployment baseline but should not be treated as the final secret-management posture.

Do not prefix the variable with `NEXT_PUBLIC_`.

## Rotation

The stored row contains only a daily HMAC and a key version.

Current implementation supports only `key_version = 1`.

Do not rotate the secret during a UTC day unless duplicate counts for that day are acceptable. Preferred procedure:

1. prepare the new secret
2. activate it immediately after a UTC date boundary
3. preserve the old secret only in the secret manager for emergency rollback
4. do not attempt to rewrite historical hashes

A future multi-key rotation scheme must introduce a new explicit key version through a migration and application update.

## Retention

Daily deduplication rows are retained for 13 months. Lifetime cumulative totals are stored separately and must not be deleted by the retention operation.

Run the bounded purge repeatedly until it returns zero:

```sql
SELECT public.purge_expired_content_daily_views(10000);
```

Recommended cadence: daily.

The function:

- selects the oldest eligible rows
- processes at most 10,000 rows per call
- skips rows locked by another purge worker
- leaves `content_view_totals` unchanged

## Monitoring queries

Run through a privileged operational connection only.

```sql
SELECT COUNT(*) AS retained_daily_rows
FROM public.content_daily_views;
```

```sql
SELECT MIN(viewed_on) AS oldest_retained_day,
       MAX(viewed_on) AS newest_retained_day
FROM public.content_daily_views;
```

```sql
SELECT COUNT(*) AS target_total_rows,
       COALESCE(SUM(unique_view_count), 0) AS cumulative_unique_views
FROM public.content_view_totals;
```

Do not expose raw daily rows or viewer hashes through public dashboards.

## Incident handling

### Missing secret

Symptom: detail pages remain functional, but passive view recording returns a controlled server error and counts do not increase.

Action: configure `VIEWER_HASH_SECRET` or restore the existing service-role secret.

### Unexpected count increase

Check:

- whether the same page is receiving many new anonymous browser tokens
- whether automated browsers execute client JavaScript
- whether a service-role credential was exposed
- whether an unsupported caller invokes the fixed write RPCs

Do not add raw IP or user-agent persistence as an emergency workaround.

### Counter integrity concern

Daily event insertion and cumulative increment are one database transaction. If integrity is still questioned, preserve the database state and inspect privileged audit evidence before modifying totals manually.

Rows older than the retention window cannot be fully reconstructed from retained daily events, so cumulative totals must not be reset casually.
