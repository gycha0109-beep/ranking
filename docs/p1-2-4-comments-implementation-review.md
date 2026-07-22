# P1-2.4 Comments and Replies Implementation Review

## Result

Status: **APPROVED AFTER REQUIRED HARDENING**

The implementation was reviewed against the design, existing hosted schema, Moderation ledger, public-content boundary, and P1-2 engagement regression baseline.

## Corrected before hosted application

### 1. Empty compact Moderation term false match

Risk:

A punctuation-only or whitespace-only `compact_substring` term could normalize to an empty string and match every comment.

Correction:

- ignore blank source terms
- require the normalized compact term to be non-empty
- preserve deterministic severity priority

### 2. Mutation-event target shape

Risk:

The first schema draft required a target only for create events and allowed malformed update/delete audit rows.

Correction:

- `comment_id` is mandatory for every event
- exactly one ranking or item target is mandatory for every event

### 3. Cursor terminal-page ambiguity

Risk:

Returning a next cursor whenever a page contained exactly the requested limit could expose an unnecessary empty page.

Correction:

- fetch `limit + 1` root IDs
- return only the requested roots
- emit a next cursor only when an additional eligible root exists

### 4. Repeated delete rate behavior

Risk:

The first draft evaluated rate limits before returning an already-deleted comment, weakening deletion idempotency.

Correction:

- lock and authorize the row first
- return the existing deleted state without adding a rate event
- enforce the rate boundary only for a new deletion

### 5. Blocked-body retention index

Risk:

Using `created_at` for a comment blocked later by edit or manual review could redact immediately even though the blocking decision was recent.

Correction:

- use `updated_at` as the retention clock
- index `updated_at, id` for blocked unredacted rows

## Required hardening after application review

### 6. Admin target links require slugs

Finding:

The Moderation queue returned target IDs and titles, but public routes use slugs.

Required correction:

- add `target_slug` to the privileged queue RPC
- use the slug for the admin target link
- do not expose the slug through any wider body projection than necessary

### 7. Comment-count scope was not surfaced

Finding:

Create/read/thread behavior was complete, but the public UI did not expose the required visible comment count.

Required correction:

- add public aggregate count RPCs for ranking and item targets
- count only `visible` comments with `clean` or `suggestive` Moderation
- validate public target eligibility
- add partial target indexes
- display the authoritative count in the comment header

## Reviewed controls

- ordinary callers cannot directly read raw comment rows
- deleted and blocked bodies are generated status text in public-safe reads
- author identity comes only from `auth.uid()`
- one-level reply depth and same-target parent constraints are database-authoritative
- target and parent rows are locked before writes
- successful mutations and automated Moderation decisions share one transaction
- automated audit insertion failure rolls back the comment mutation
- edit and delete require exact `updated_at`
- manual Moderation changes synchronize lifecycle visibility through a trigger
- deleted lifecycle is terminal for the visibility trigger
- rate checks are serialized per user and supported by a bounded index
- public pagination selects root threads and attaches replies without splitting threads
- blocked-body redaction is bounded and service-role-only
- admin queue uses a dedicated role-checked RPC
- plain text is rendered without HTML interpretation
- no optimistic public insertion occurs before the Moderation result
- ranking and item detail routes mount one shared comment component through route layouts

## Remaining validation gates

- migration application in exact order
- authenticated mutation smoke with temporary users
- clean, suggestive, needs-review, and blocked decisions
- one-level reply and invalid-parent rejection
- cross-user ownership rejection
- stale edit and stale delete rejection
- public/author/admin body visibility
- cursor page continuity
- manual review lifecycle synchronization
- bounded redaction without ledger mutation
- table and RPC privilege matrix
- lint, type-check through production build, and exact-head CI

No unresolved critical or high-severity design issue remains after the required hardening migration and application corrections are applied.
