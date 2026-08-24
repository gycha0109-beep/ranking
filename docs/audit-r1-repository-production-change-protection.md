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

## Historical external-authority blocker

At the initial R1 implementation point, the connected GitHub action surface did not expose a branch-protection/ruleset mutation operation. The repository-side safeguard therefore could not substitute for the missing GitHub receive-time rule.

That historical blocker was resolved when the repository administrator saved the branch-protection configuration in GitHub and the rule was subsequently read back from GitHub.

## Repository-side fallback safeguard

`.github/workflows/main-ingress-audit.yml` remains a detection-only defense in depth mechanism.

For every push to `main`, it:

- uses read-only repository / pull-request permissions,
- asks GitHub for pull requests associated with the new `main` HEAD,
- requires an associated PR merged into `main`,
- requires that PR's `merge_commit_sha` to equal the pushed `main` HEAD,
- fails loudly when the push cannot be tied to a merged PR.

This workflow is not treated as equivalent to GitHub branch protection; the authoritative gate is the active GitHub protection rule.

## Final closeout readback — 2026-08-24

Current authoritative GitHub branch readback reports:

- `main.protected = true`
- required status-check context: `validate`
- required status-check enforcement level: `everyone`
- current audited `main`: `b668cae74f5c20755eac2b49f6275b9c77e23e9c`

PR #98 and PR #99 were merged only after their required `CI / validate` checks succeeded, providing operational evidence that the required check is functioning as a merge gate.

The connector's abbreviated branch readback does not enumerate every lower-level branch-protection boolean. Therefore this document does not manufacture a machine-read value for force-push/deletion subfields that the current connector does not expose. The administrator-applied rule remains the GitHub authority for those configured controls.

Final R1 state:

`REPOSITORY_PROTECTION_STATUS = VERIFIED`

`REQUIRED_CHECK = validate`

`REQUIRED_CHECK_ENFORCEMENT = everyone`

`MAIN_PROTECTED = TRUE`

`DIRECT_PUSH_DETECTION = IMPLEMENTED`

`AUDIT_R1 = SUCCESS / CLOSED`
