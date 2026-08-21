import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = (path) => fs.readFileSync(path, 'utf8')
const itemPage = read('src/app/items/[itemSlug]/page.tsx')
const itemLayout = read('src/app/items/[itemSlug]/layout.tsx')
const itemMetadataSource = read('src/lib/item-metadata.ts')
const publicQueries = read('src/lib/queries/public.ts')
const safeImage = read('src/components/SafeImage.tsx')

const transpiled = ts.transpileModule(itemMetadataSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const metadataModule = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)
const { buildPublicItemFacts, formatItemMachineLabel } = metadataModule

assert.equal(formatItemMachineLabel('sports_team'), 'Sports Team')
assert.equal(formatItemMachineLabel('city'), '도시')
assert.equal(formatItemMachineLabel('airport'), '공항')
assert.equal(formatItemMachineLabel('supercomputer'), '슈퍼컴퓨터')
assert.equal(formatItemMachineLabel('iso2'), 'ISO2')
assert.equal(formatItemMachineLabel('oecd_code'), 'OECD 코드')
assert.equal(formatItemMachineLabel('pisa_label'), 'PISA 표기명')

const facts = buildPublicItemFacts({
  iso2: 'KR',
  internal_note: 'must-not-render',
  source_url: 'https://example.com/private-ish-display',
  nested: { unsafe: true },
  aliases: ['Republic of Korea', 'Korea'],
  score: 1234,
  enabled: true,
  empty: '   ',
  very_long_value: 'x'.repeat(200),
  zeta: 'last',
  alpha: 'first',
  extra: 'bounded',
})

assert.ok(facts.length <= 8, 'public metadata fact renderer must stay bounded')
assert.ok(facts.every((fact) => fact.key !== 'internal_note'), 'internal metadata keys must not render')
assert.ok(facts.every((fact) => fact.key !== 'source_url'), 'raw URL metadata values must not render')
assert.ok(facts.every((fact) => fact.key !== 'nested'), 'nested metadata objects must not render')
assert.ok(facts.some((fact) => fact.key === 'aliases' && fact.value === 'Republic of Korea · Korea'), 'simple arrays should render compactly')
assert.ok(facts.some((fact) => fact.key === 'enabled' && fact.value === '예'), 'boolean facts should render in a user-facing form')
assert.ok(facts.some((fact) => fact.key === 'score' && fact.value === '1,234'), 'number facts should use locale formatting')
assert.ok(facts.every((fact) => fact.value.length <= 120), 'public fact values must stay bounded')

for (const fixture of [
  { series: 'One Piece', affiliation: 'Straw Hat Pirates', role: 'Captain' },
  { developer: 'Nintendo', platform: 'Switch', genre: 'Action RPG' },
  { brand: 'Example Brand', concentration: 'EDT', release_year: 2015 },
  { gender: 'women', fifa_code: 'ESP', competition: 'World Ranking' },
]) {
  const rendered = buildPublicItemFacts(fixture)
  assert.ok(rendered.length > 0, 'cross-domain scalar metadata fixture must render without an item-type branch')
}

assert.ok(itemPage.includes('buildPublicItemFacts(item.metadata)'), 'item page must derive facts from existing metadata JSONB')
assert.ok(itemPage.includes('<CommentSection targetType="item"'), 'item discussion must use the existing item comment contract')
assert.ok(itemPage.includes('fallbackSrc="/item-placeholder.svg"'), 'item images must use the local neutral fallback')
assert.ok(itemPage.includes('item.facets && item.facets.length > 0'), 'existing item facet contract must remain available')
assert.ok(itemPage.includes('getRankingsContainingItem(item.id)'), 'ranking membership must remain reverse-derived from existing entries')
assert.ok(itemPage.includes('getRelatedItems(item)'), 'existing related item query must remain in use')
assert.ok(itemPage.includes("related.related_reason !== '같은 카테고리'"), 'item detail must suppress broad category-only related item fallback')
assert.ok(itemPage.includes('contextualRelatedItems.length > 0'), 'related item surface must key off contextual results after filtering')
assert.ok(!itemPage.includes('images.unsplash.com'), 'item detail must not hotlink a stock fallback')
assert.ok(!safeImage.includes('images.unsplash.com'), 'shared SafeImage default must not hotlink a stock fallback')
assert.ok(safeImage.includes("fallbackSrc = '/item-placeholder.svg'"), 'shared SafeImage default must use the local neutral fallback')
assert.ok(!itemLayout.includes('<CommentSection'), 'item layout must not duplicate article-flow comments')
assert.ok(publicQueries.includes("const PUBLIC_ITEM_COLUMNS = 'id, title, slug, description, item_type, image_url, brand_or_creator, external_url, affiliate_url, status, metadata"), 'public item query must continue exposing the existing metadata contract')

const footprintIndex = itemPage.indexOf('>이 아이템이 등장하는 랭킹</h2>')
const factsIndex = itemPage.indexOf('>핵심 정보</h2>')
const discussionIndex = itemPage.indexOf('id="discussion"')
const relatedIndex = itemPage.indexOf('>관련 아이템</h2>')
assert.ok(footprintIndex >= 0, 'ranking footprint section missing')
assert.ok(discussionIndex > footprintIndex, 'discussion must follow the ranking footprint')
assert.ok(factsIndex < 0 || (factsIndex > footprintIndex && factsIndex < discussionIndex), 'structured item facts must stay between ranking footprint and discussion')
assert.ok(relatedIndex < 0 || relatedIndex > discussionIndex, 'related items must stay auxiliary and below discussion')

for (const forbidden of ['coach', 'stadium', 'perfume_notes', 'fragrance_family', 'anime_series']) {
  assert.ok(!itemPage.includes(forbidden), `item page must not hardcode domain field: ${forbidden}`)
}

console.log('UI-2C cross-domain item detail contracts verified.')
