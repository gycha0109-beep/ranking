import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const helperSource = fs.readFileSync('src/lib/ranking-display.ts', 'utf8')
const rankingPage = fs.readFileSync('src/app/rankings/[rankingSlug]/page.tsx', 'utf8')

const transpiled = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const displayModule = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)
const { formatKoreanDate, formatRankingBasis } = displayModule

assert.equal(formatRankingBasis({ period: 'PISA 2022' }, '2026-08-19T00:00:00Z'), 'PISA 2022')
assert.equal(formatRankingBasis({ period: '2025 정규시즌 최종' }, '2026-08-19T00:00:00Z'), '2025 정규시즌 최종')
assert.equal(formatRankingBasis({ period: 'TOP500 June 2026 (67th edition)' }, '2026-08-21T00:00:00Z'), 'TOP500 June 2026 (67th edition)')
assert.equal(formatRankingBasis({ period: '2026-06-30 기준' }, '2026-08-21T00:00:00Z'), '2026. 6. 30.')
assert.equal(formatRankingBasis({}, '2026-08-21T16:30:00Z'), '2026. 8. 22.')
assert.equal(formatKoreanDate('2026-08-21T16:30:00Z'), '2026. 8. 22.')

assert.ok(rankingPage.includes("from '@/lib/ranking-display'"), 'ranking detail must use the shared basis/date display helper')
assert.ok(
  rankingPage.includes('>기준</p>')
    || rankingPage.includes('>기준</dt>')
    || rankingPage.includes('>기준 시점</dt>'),
  'ranking detail must expose a basis field rather than 기준일'
)
assert.ok(!rankingPage.includes('>기준일</p>') && !rankingPage.includes('>기준일</dt>'), 'ranking detail must not mislabel editorial periods as a date')
assert.ok(rankingPage.includes('formatRankingBasis(ranking.scope_json, publishedOrUpdated)'), 'ranking detail must prefer scope.period semantics')
assert.ok(rankingPage.includes('formatKoreanDate(ranking.updated_at)'), 'ranking updated timestamps must render in Asia/Seoul')

console.log('CONTENT-5 ranking basis display contracts verified.')
