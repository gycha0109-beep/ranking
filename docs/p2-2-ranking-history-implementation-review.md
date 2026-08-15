# P2-2 Ranking Change History & Vote Finalization — Implementation Review

## Result

**PASSED FOR HOSTED VALIDATION**

Baseline: `00ce3f6e13b8928fd4a80e4b1d0e896388130c57`.

Reviewed feature head before Hosted validation: `f5f475714ea2915f034c770a423b108ec63a9a42` plus this review commit.

## Verified implementation properties

- Branch is based exactly on the current P2-1 merged main and is not behind it.
- Raw revision/history tables are RLS-enabled and direct anon/auth table access is revoked.
- Revision rows and entry snapshots reject UPDATE/DELETE.
- Ranking history uses stable item UUID values plus title/slug/reason snapshots rather than volatile ranking-entry IDs.
- Public history is bounded, public-ranking gated, actor-free, and ballot-identity-free.
- `vote_void` public history suppresses candidate-level snapshot output.
- Finalization and void require `content_manage`, a closed voting state, and a bounded operator reason.
- Finalization preserves P2-1 deterministic ordering: vote count DESC → seed/canonical position ASC → item UUID ASC.
- Finalization requires all current candidates/items to be public-safe and active; invalid rounds must use the audited void path.
- Finalization shares the P2-1 exclusive voting-state advisory lock.
- Finalization persists revision/entry snapshots before deleting current ballots.
- Ballots are consumed before canonical-entry mutation so the existing P2-1 freeze trigger remains authoritative rather than being bypassed.
- Canonical position permutation uses a positive temporary offset before final dense positions, avoiding unique-position collisions.
- Finalization/void are single PostgreSQL function transactions; any error rolls back snapshots, ballot consumption, and position changes together.
- Completed ballots are consumed so a later open naturally starts a fresh round and the first-ballot edit freeze does not leak across rounds.
- Physical ranking deletion is blocked once immutable history exists.
- Admin controls require a reason and expose both finalize and auditable void operations.
- Public ranking detail mounts recent official ranking-order history.
- P2-2 verifier is wired after P2-1 in CI.

## Environment note

The analysis container cannot resolve `github.com`, so a local repository clone/build could not be used as a pre-Hosted check. This is not treated as a product blocker: SQL compilation/semantic validation is performed by Hosted Postgres next, and exact-head GitHub Actions remains the authoritative JS/TS verifier/lint/build gate before PR readiness.

## Hosted validation requirements

Hosted validation must prove both terminal paths and rollback safety with synthetic fixtures, then leave zero fixture residue.
