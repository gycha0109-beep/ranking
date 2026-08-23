# AUDIT-R1 — Repository Production Change Protection

## Scope

AUDIT-R1 addresses repository-level protection for the Production source branch only. It does not redesign product behavior, database authorization, Production E2E, or MEASURE-2 evidence policy.

## Authority baseline

- Repository: `gycha0109-beep/ranking`
- Baseline `main`: `1fa6c37926811293fc53c9e553eb9419c7b00850`
- Baseline open PRs: `0`
- Production deployment: `dpl_9XZb5YG3NsGJxwCuWRa2Srg8uhzr`
- Production exact git SHA: `1fa6c37926811293fc53c9e553eb9419c7b00850`
- Production state: `READY`
- Baseline branch readback: `main.protected = false`
- Baseline required status checks: enforcement `off`, contexts `[]`, checks `[]`

## Authoritative CI check

The current PR CI workflow is `.github/workflows/ci.yml`:

- workflow name: `CI`
- job name: `validate`
- latest audited PR run: `CI` run `32622774729`
- audited job id: `97153403165`
- audited job result: `validate = success`

The required GitHub Actions job to bind to branch protection is therefore `validate` (displayed by GitHub Actions under the `CI` workflow).

Production E2E is intentionally not selected as the initial required merge check because it is a separate Production/environment-dependent workflow rather than the deterministic PR validation gate.

## Desired enforced branch policy

The `main` rule must enforce all of the following before AUDIT-R1 may be called closed:

1. Require a pull request before merging.
2. Require status checks to pass before merging.
3. Require the authoritative `validate` CI job.
4. Block force pushes.
5. Block branch deletion.
6. Do not permit repository administrators to bypass the rule for normal Production changes.

## Current external-authority blocker

The connected GitHub account has repository admin authority and the repository is public, so GitHub plan/repository eligibility is not the blocker.

The current connected GitHub action surface can read branch protection state and can write branches/files/PRs, but it does not expose a branch-protection or repository-ruleset create/update operation. Therefore this continuation cannot truthfully mark the GitHub rule as applied from the available write surface.

`REPOSITORY_PROTECTION_STATUS = NOT_APPLIED`

`AUDIT_R1_EXTERNAL_AUTHORITY = BLOCKED_BY_CONNECTED_GITHUB_WRITE_SURFACE`

## Repository-side fallback safeguard

`.github/workflows/main-ingress-audit.yml` is a detection-only safeguard while the actual GitHub protection rule is absent.

For every push to `main`, it:

- uses read-only repository / pull-request permissions,
- asks GitHub for pull requests associated with the new `main` HEAD,
- requires an associated PR merged into `main`,
- requires that PR's `merge_commit_sha` to equal the pushed `main` HEAD,
- fails loudly when the push cannot be tied to a merged PR.

This workflow is intentionally explicit that branch protection is still missing.

### Limitation

This workflow runs after Git has accepted the push. It detects policy violations; it cannot reject a direct push at Git receive time and cannot be treated as equivalent to branch protection. It also cannot, by itself, guarantee that Vercel has not already observed the accepted push.

Therefore:

`DIRECT_PUSH_DETECTION = IMPLEMENTED`

`DIRECT_PUSH_PROTECTION = NOT_VERIFIED`

`FORCE_PUSH_PROTECTION = NOT_VERIFIED`

`DELETE_PROTECTION = NOT_VERIFIED`

## Close condition

AUDIT-R1 remains blocked until an authoritative GitHub readback shows the `main` protection/ruleset is active with the required PR/status-check/force-push/delete semantics.

Only after that readback may the stage state become:

`REPOSITORY_PROTECTION_STATUS = VERIFIED`

`REQUIRED_CHECK = validate`

`DIRECT_PUSH_PROTECTION = VERIFIED`

`FORCE_PUSH = BLOCKED`

`DELETE_PROTECTION = VERIFIED`

`AUDIT_R1 = SUCCESS / CLOSED`

Until then:

`AUDIT_R1 = BLOCKED`
