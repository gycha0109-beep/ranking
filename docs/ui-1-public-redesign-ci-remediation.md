# UI-1 Exact-Head CI Remediation

## Baseline

- authoritative main: `f6bdbb31c7c32f5c3b1f00e97a5450b69d9ec75b`
- feature branch: `feat/ui-1-public-redesign`

## CI remediation history

### Run #107

Head: `1e6494851a4f13164c22558662f5ab538553ed9b`

Failed at `verify:p1-3` because UI-1 changed the established home-section string `최근 발행 아카이브 문서` to a different label.

Resolution: restored the P1-3 wording contract without changing UI-1 information architecture.

### Run #108

Head: `fe4c072acded23b9c0a6c4f0347766599fa9f0e2`

P1-2/P1-3 passed. `verify:p1-4` failed because the Facet composition help no longer included the established phrase `같은 그룹에서는 하나라도 일치`.

Resolution: restored the user-facing composition statement as `같은 그룹에서는 하나라도 일치하면 되고, 다른 그룹과는 모두 일치해야 합니다.`

### Run #109

Head: `af57af45da285b893136688b6028fddd9a910e90`

P1-2 through P1-5 passed. `verify:p2-1` failed because the voting heading was shortened from `사용자 투표 순위` to `사용자 투표`.

Resolution: restored `사용자 투표 순위`. The P2-2 finalization button was also proactively restored from the shortened `결과 확정` label to the established `투표 결과 확정` wording.

### Run #110

Final exact head: `36e09d62ded9d498e11bf06f668ff0b03bc888b8`

Result: **SUCCESS**

Passed:

- `verify:p1-2`
- `verify:p1-3`
- `verify:p1-4`
- `verify:p1-5`
- `verify:p2-1`
- `verify:p2-2`
- `verify:ui-1`
- ESLint
- Next production build

## Review conclusion

All remediation items were compatibility wording fixes. No P1/P2 data, search, moderation, engagement, voting, finalization, history, or SEO semantic contract was weakened to make UI-1 pass.

The final feature head remains based directly on the authoritative UI-1 baseline main with `behind=0`.
