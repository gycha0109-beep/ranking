# P1-1.5 Definition of Done

- [x] Public queries use an anon-only Supabase client.
- [x] Public ranking, item, and entry selects enumerate allowed columns.
- [x] Anonymous users cannot read internal notes or moderation review audit notes.
- [x] Development admin bootstrap is not exported as a Server Action and resolves the current session internally.
- [x] Login redirect targets reject external and protocol-relative paths on both client and server boundaries.
- [x] Core database functions use fixed search paths.
- [x] Trigger-only functions are not executable by API roles.
- [x] Lint passes.
- [x] Production build passes.
- [x] CI workflow added for pull requests and main.
