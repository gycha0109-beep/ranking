# P2-2 Ranking Change History & Vote Finalization — Hosted Validation Review

## Result

**PASSED / READY FOR EXACT-HEAD CI**

## Review conclusions

### Schema / migration consistency

- Both P2-2 repository migrations are applied to Hosted Supabase in repository order.
- Hosted migration head is `20260815164926 p2_2_public_history_moderation_filter`.
- The second migration is a repository-tracked remediation discovered during validation, not ad-hoc Hosted drift.

### Transaction semantics

The rollback fixture proved the intended terminal round lifecycle end to end:

- open rounds cannot finalize;
- closed safe rounds can finalize;
- aggregate ordering becomes canonical order;
- snapshots precede ballot consumption;
- completed ballots do not leak into the next round;
- multiple rounds advance deterministic revision/round numbers;
- moderation degradation uses the existing P2-1 auto-close behavior;
- unsafe rounds cannot finalize and can only terminate through the audited void path;
- void does not change canonical order;
- history mutations are rejected;
- rankings with immutable history cannot be physically deleted.

### Public privacy / moderation

The Hosted fixture additionally proved the remediation requirement that immutable historical labels cannot bypass current moderation. When a previously finalized candidate is blocked later, that candidate disappears from historical public diff output while the immutable raw snapshot remains closed behind the RPC boundary.

Voided rounds expose their reason and terminal event but no candidate-level details.

### Data residue

After fixture rollback, all P2-2 and P2-1 voting data counts remain zero. There is no synthetic production residue.

### Advisors

P2-2 introduces no unindexed-FK finding. New RLS/SECURITY DEFINER notices match the intentional RPC-only architecture and capability checks. No advisor finding requires another P2-2 migration before CI.

## Gate decision

Hosted validation is complete. The next authoritative gate is exact-head GitHub Actions on the final feature SHA, including all P1 verifiers, P2-1, P2-2, lint, and production build.
