import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }
const expectContains = (text, value, message) => expect(text.includes(value), message)
const expectNotContains = (text, value, message) => expect(!text.includes(value), message)

const globals = read('src/app/globals.css')
const rootLayout = read('src/app/layout.tsx')
const navbar = read('src/components/Navbar.tsx')
const home = read('src/app/page.tsx')
const search = read('src/app/search/page.tsx')
const facets = read('src/components/FacetFilterPanel.tsx')
const category = read('src/app/categories/[categorySlug]/page.tsx')
const subcategory = read('src/app/categories/[categorySlug]/[subcategorySlug]/page.tsx')
const ranking = read('src/app/rankings/[rankingSlug]/page.tsx')
const rankingLayout = read('src/app/rankings/[rankingSlug]/layout.tsx')
const item = read('src/app/items/[itemSlug]/page.tsx')
const itemLayout = read('src/app/items/[itemSlug]/layout.tsx')
const login = read('src/app/login/LoginForm.tsx')
const engagement = read('src/components/engagement/LikeDock.tsx')
const voting = read('src/components/voting/RankingVotingPanel.tsx')
const history = read('src/components/ranking-history/RankingHistoryPanel.tsx')
const comments = read('src/components/comments/CommentSection.tsx')

expectContains(globals, '--rw-canvas:', 'global semantic canvas token missing')
expectContains(globals, '--rw-surface:', 'global semantic surface token missing')
expectContains(globals, '--rw-brand:', 'global semantic brand token missing')
expectContains(globals, '--rw-text-muted: #5f6875;', 'accessible muted text token missing')
expectContains(globals, '[class*="text-[#8a94a3]"]', 'legacy muted arbitrary color compatibility mapping missing')
expectContains(globals, '[class*="text-[#9aa3af]"]', 'legacy low-contrast arbitrary color mapping missing')
expectContains(globals, '[class*="text-[#a0a8b3]"]', 'legacy light-muted arbitrary color mapping missing')
expectContains(globals, '[class*="text-[#62748e]"]', 'legacy login muted color mapping missing')
expectNotContains(globals, '.rw-comment-shell [class*=', 'native light comments must not depend on a legacy compatibility shim')
expectContains(comments, 'text-[#303640]', 'comment component must own a native light text surface')
expectContains(comments, 'border-[#dfe3e8]', 'comment component must own a native light border surface')
expectNotContains(rootLayout, 'className="h-full antialiased dark"', 'root html must not force dark mode')
expectNotContains(rootLayout, 'bg-[#07070a]', 'root public shell must not use legacy dark background')

expectContains(navbar, 'bg-white/95', 'navbar must use the light public shell')
expectContains(navbar, '<details className="relative md:hidden">', 'mobile navigation details surface missing')
expectNotContains(navbar, '에디터 로그인', 'public login label must not be editor-only wording')

for (const [name, source] of [
  ['home', home],
  ['search', search],
  ['category', category],
  ['subcategory', subcategory],
  ['ranking', ranking],
  ['item', item],
]) {
  expectContains(source, 'rw-page', `${name} must use the UI-1 public page shell`)
  expectNotContains(source, 'bg-[#07070a]', `${name} must not reintroduce the legacy dark canvas`)
}

expectContains(login, 'className="rw-muted mt-5 text-center text-xs leading-5"', 'login footer must use the accessible muted text token')
expectNotContains(login, 'mt-5 text-center text-xs leading-5 text-slate-500', 'login footer must not use the low-contrast slate-500 utility')

expectContains(facets, 'lg:hidden', 'facet filter must expose a mobile surface')
expectContains(facets, 'lg:block', 'facet filter must expose a desktop surface')
expectContains(search, 'lg:grid-cols-[260px_minmax(0,1fr)]', 'search must use desktop filter/result composition')
expectContains(category, 'lg:grid-cols-[260px_minmax(0,1fr)]', 'category browse must use desktop filter/result composition')
expectContains(subcategory, 'lg:grid-cols-[260px_minmax(0,1fr)]', 'subcategory browse must use desktop filter/result composition')

const rankingTableIndex = ranking.indexOf('>순위</h2>')
const methodologyIndex = ranking.indexOf('>이 순위가 만들어진 기준</h2>')
expect(rankingTableIndex >= 0 && methodologyIndex >= 0 && rankingTableIndex < methodologyIndex, 'ranking table must appear before methodology')
expectContains(ranking, '총 {ranking.entries.length}개 항목', 'ranking detail must expose entry count near primary table')
expectContains(ranking, 'aria-label={`${source.label} 출처 열기`}', 'icon-only ranking source links must expose a discernible accessible name')
expectContains(ranking, 'rw-comment-shell', 'ranking comments must remain grouped inside the public article flow')
expectContains(ranking, '<CommentSection targetType="ranking"', 'ranking comments must remain available in the article flow')
expect(
  item.includes('>이 아이템이 등장하는 랭킹</h2>')
    || item.includes('>이 항목은 어디에서 몇 등인가요?</h2>'),
  'item detail must prioritize ranking footprint'
)
expectContains(item, 'rw-comment-shell', 'item comments must remain grouped inside the public article flow')
expectContains(item, '<CommentSection targetType="item"', 'item comments must remain available in the article flow')

expectNotContains(rankingLayout, 'bg-[#07070a]', 'ranking interaction layout must not use legacy dark wrapper')
expectNotContains(itemLayout, 'bg-[#07070a]', 'item interaction layout must not use legacy dark wrapper')
expectNotContains(itemLayout, '<CommentSection', 'item layout must not duplicate the article-flow comment section')

expectNotContains(engagement, '#101017', 'engagement bar must not use legacy dark dock')
expectContains(engagement, 'bg-white/95', 'engagement bar must use light surface')
expectNotContains(voting, 'cyan-', 'voting UI must not use the legacy cyan standalone visual language')
expectContains(voting, '관리자 투표 제어', 'voting admin terminal controls must remain present')
expectContains(voting, '<details', 'voting admin terminal controls must be visually separated')
expectContains(history, 'border-l-2', 'history must render as a timeline')

if (failures.length > 0) {
  console.error('UI-1 contract verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('UI-1 public redesign contracts verified.')
