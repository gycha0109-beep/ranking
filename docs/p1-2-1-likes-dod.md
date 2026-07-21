# P1-2.1 Likes Definition of Done

- [x] Ranking and item likes use independent fixed RPCs.
- [x] Authenticated users can set and clear their desired like state.
- [x] Repeated identical requests are idempotent.
- [x] Concurrent state transitions and rate-limit checks are serialized.
- [x] Exactly one target is enforced for every like row.
- [x] Duplicate user-target rows are prevented by unique indexes.
- [x] Anonymous writes and direct API-role table mutations are denied.
- [x] Draft, inactive, blocked, or otherwise non-public targets are rejected.
- [x] Item likes require reachability from a public ranking.
- [x] Aggregate counts are public while raw user activity remains private.
- [x] Ranking and item detail pages expose an optimistic Like UI with rollback.
- [x] Anonymous interaction redirects through a validated relative login return path.
- [x] Hosted Supabase migration history contains all forward migrations.
- [x] Transactional hosted smoke tests passed and rolled back.
- [x] Independent review findings were corrected and documented.
- [ ] Final pull-request lint and production build pass.
