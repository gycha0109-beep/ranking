# P2-1 User Voting — Current State

Baseline: `main @ cba0f5bea765b850a83ad97f8441ce42233f5f55`

## Repository

- `rankings.ranking_type` already accepts `user_vote`.
- Admin ranking creation already exposes `user_vote`.
- Public ranking detail labels `user_vote`, but renders `ranking_entries.position` only.
- No vote table, vote RPC, vote aggregate, voting lifecycle, or voting UI exists.
- Existing public eligibility is `published` ranking + clean/suggestive moderation + active/public-safe entry item.
- Existing `private.assert_user_capability(..., 'engagement_write')` blocks account-suspended users and is reusable for voting.
- Existing admin capability `content_manage` is the appropriate authority for opening/closing voting.
- Raw engagement storage is not exposed publicly; P2-1 should preserve that pattern.

## Ranking edit behavior

The currently wired admin editor uses a multi-request delete/reinsert save path for ranking entries. Therefore a vote cannot safely reference `ranking_entry_id` and live candidate mutation after votes would make ballots ambiguous.

P2-1 uses `(ranking_id, item_id)` ballots and freezes the voted ranking/candidate document after the first remaining ballot. Moderation and publication state changes remain permitted so safety controls still work.

## Hosted Supabase

At investigation time:

- migration head: `20260815145454 p1_4_facet_discovery`
- rankings: 2
- published rankings: 1
- user_vote rankings: 0
- profiles: 2
- vote tables/functions: none

No Hosted mutation was performed during investigation.
