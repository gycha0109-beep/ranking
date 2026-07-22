# P1-2.3 Daily Unique Views Implementation Review

## Result

Status: **APPROVED AFTER REQUIRED CORRECTIONS**

No critical or high-severity issue was found. Three medium/low implementation corrections are required before hosted validation.

## Reviewed implementation

- private daily deduplication rows
- cumulative lifetime total rows
- fixed ranking/item write RPCs
- fixed ranking/item aggregate read RPCs
- bounded retention purge RPC
- server-derived anonymous and authenticated viewer keys
- HttpOnly first-party anonymous token
- path-to-target verification before service-role invocation
- engagement-dock recording and count display

## Finding 1: unsupported key versions were accepted

Severity: Medium

The table and write function accepted every positive `key_version`, while application HMAC derivation implements only version 1. This permits semantically invalid rows if another trusted caller invokes the service-role RPC with an unsupported version.

Required correction:

- constrain current rows to `key_version = 1`
- reject write requests unless `p_key_version = 1`
- expand accepted versions only through an explicit future migration

## Finding 2: compact-screen engagement controls can overflow

Severity: Low

Adding a third view-count control to the fixed engagement dock can exceed narrow viewport width because the inner container does not wrap.

Required correction:

- allow the inner dock to wrap and right-align wrapped controls
- preserve existing like and bookmark behavior

## Finding 3: operational secret and retention procedure need an explicit runbook

Severity: Low

The code supports a dedicated `VIEWER_HASH_SECRET` and a service-role fallback, and the database exposes a bounded purge RPC. Production operators still need a concise configuration and retention procedure.

Required correction:

- document dedicated secret generation and rotation constraints
- document fallback limitations
- document daily bounded purge invocation
- document that cumulative totals are never purged

## Security review

### Passed

- Browser roles cannot provide an authoritative viewer hash.
- Browser roles do not receive raw event rows.
- Write and purge RPCs are service-role-only.
- Count RPCs return aggregate integers only.
- Raw IP address, user agent, referrer, token, user ID, and email are not persisted.
- HMAC inputs use feature/version/date/identity-kind domain separation.
- Target ID is matched to the validated route slug before privileged invocation.
- Database functions independently validate and lock public target eligibility.
- Repeated same-day requests rely on unique constraints, not client behavior.
- Cumulative totals increment only when a new deduplication row is inserted.
- Purging old deduplication rows does not reduce lifetime totals.

### Accepted limitations

- Anonymous uniqueness means browser-token uniqueness, not guaranteed human uniqueness.
- Clearing cookies, using another browser, or switching between anonymous and authenticated state can create another daily count.
- Bot classification and IP/user-agent fingerprinting remain intentionally out of scope.
- A dedicated `VIEWER_HASH_SECRET` is preferred; service-role fallback is transitional.

## Regression review

The implementation does not change:

- like table or RPC contracts
- bookmark privacy or RPC contracts
- ranking/item publication rules
- Moderation review history
- public content column projections

Passive view-recording failures do not block likes, bookmarks, or page rendering.

## Approval gate

Implementation may proceed to hosted migration and verification after all three corrections are committed.
