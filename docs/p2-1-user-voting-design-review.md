# P2-1 User Voting — Design Review

## Review result

**PASSED WITH RECONCILIATION**

## Findings

### 1. `ranking_entry_id` ballot reference is unsafe

The wired admin editor recreates ranking entry rows. Ballots must reference stable `(ranking_id, item_id)` instead.

### 2. Candidate-only freeze is insufficient with the current save path

The wired editor performs ranking update and entry replacement as separate requests. Allowing document edits after votes while only blocking candidate changes could permit partial saves. P2-1 therefore tightens the freeze: after the first remaining ballot, ranking content and candidate configuration are immutable except publication/moderation controls.

This is stricter than the initial candidate-only proposal but preserves correctness without introducing a second ranking revision system before P2-2.

### 3. Moderation cannot be frozen

Safety controls must remain available after voting begins. Ranking moderation fields, entry moderation fields, item moderation/status changes, and publication state remain operative. Open voting reconciles to `closed` if the public ranking/candidate boundary is no longer valid.

### 4. Live position materialization is deferred

Writing vote order into `ranking_entries.position` would mix mutable aggregate state with authored ranking state and would pre-empt P2-2 change history. P2-1 presents live aggregate order separately and uses that order for user-vote JSON-LD only.

### 5. No destructive reset in V1

An admin reset would erase participation without a ranking revision/history contract. It is intentionally excluded. Closed polls can be reopened with their existing ballots; a new candidate set should use a new ranking/revision until P2-2 exists.
