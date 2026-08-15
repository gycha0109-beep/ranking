# P2-1 User Voting — Implementation Review

Implementation branch: `feat/p2-1-user-voting`
Baseline: `cba0f5bea765b850a83ad97f8441ce42233f5f55`

## Review result

**PASSED AFTER FIXES**

## Reviewed surfaces

- repository voting migrations and grants
- SECURITY DEFINER fixed search paths
- account and admin capability enforcement
- advisory-lock concurrency boundaries
- candidate/public moderation predicates
- vote aggregate ordering and privacy boundary
- first-ballot freeze triggers
- moderation/publication exceptions to the freeze
- public voting panel and server actions
- user-vote SEO/JSON-LD ordering
- CI contract verifier

## Findings and remediation

### 1. Client prop synchronization could violate the existing React lint contract

The initial `RankingVotingPanel` used `useEffect -> setState` synchronization for server-refreshed props. The repository already treats synchronous effect state updates as a lint failure pattern.

Fix: remove effect synchronization. Local state is updated by successful mutations and a router refresh supplies a fresh server tree when needed.

### 2. Safety controls must remain usable after first vote

A blanket freeze would prevent moderation and unpublish operations after participation begins.

Fix: ranking moderation fields, entry moderation fields, and publication status remain mutable. Authored document/candidate changes remain blocked while ballots exist.

### 3. Vote-specific FK reverse indexes were initially absent

Supabase performance advisor reported new unindexed FK INFO for:

- `ranking_votes.item_id`
- `ranking_votes.user_id`
- `ranking_vote_settings.updated_by`

Fix: add repository migration `20260816011000_p2_1_vote_fk_indexes.sql` with dedicated reverse indexes. Re-running the advisor removed all P2-1 unindexed-FK findings.

## Accepted V1 tradeoffs

- the main authored ranking body still shows seed positions; the new voting panel is explicitly labeled as the authoritative live user-vote order
- no destructive vote reset
- no finalization/materialization into `ranking_entries.position`
- no vote event history or revision system until P2-2

No blocking implementation issue remains before exact-head CI.
