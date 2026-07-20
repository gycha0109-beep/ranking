# P1-1.6 Definition of Done

- [x] Ranking and all child collections are written by one PostgreSQL RPC transaction.
- [x] Target ranking row is locked before validation and replacement.
- [x] Published ranking edits atomically become draft and clear `published_at`.
- [x] Partial delete/insert states cannot commit.
- [x] Server and database validation cover required scope, criteria, entries, references, and duplicates.
- [x] Moderation terms are loaded once per save and fail closed.
- [x] Existing admin action imports remain compatible through the async facade.
- [x] Live Supabase transaction smoke passed and rollback preserved production data.
- [x] `npm run lint` passed.
- [x] `npm run build` passed.
