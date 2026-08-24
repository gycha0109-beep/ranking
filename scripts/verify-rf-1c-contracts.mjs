import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const profileAdapterPath = path.join(root, 'src/lib/recommendation/rf1-profile-adapter.ts')
const profileServerPath = path.join(root, 'src/lib/recommendation/rf1-profile-server.ts')
const shadowPath = path.join(root, 'src/lib/recommendation/rf1-shadow.ts')
const migrationPath = path.join(root, 'supabase/migrations/20260824062000_rf_1c_profile_evidence_read.sql')
const rankingPagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')

function fail(message) {
  console.error(`RF-1C contract failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function expectThrow(fn, message) {
  let threw = false
  try {
    fn()
  } catch {
    threw = true
  }
  assert(threw, message)
}

for (const requiredPath of [profileAdapterPath, profileServerPath, shadowPath, migrationPath, rankingPagePath]) {
  assert(fs.existsSync(requiredPath), `${path.relative(root, requiredPath)} must exist`)
}

const adapterSource = fs.readFileSync(profileAdapterPath, 'utf8')
const profileServerSource = fs.readFileSync(profileServerPath, 'utf8')
const shadowSource = fs.readFileSync(shadowPath, 'utf8')
const migration = fs.readFileSync(migrationPath, 'utf8')
const rankingPageSource = fs.readFileSync(rankingPagePath, 'utf8')

assert(migration.includes('CREATE OR REPLACE FUNCTION public.get_rf1_my_profile_events'), 'authenticated RF-1 profile read RPC must exist')
assert(migration.includes('v_user_id UUID := auth.uid()'), 'profile evidence must bind the current authenticated user')
assert(migration.includes('public.content_bookmark_events'), 'profile evidence must reuse existing bookmark-event authority')
assert(migration.includes('e.changed = TRUE'), 'profile evidence must use actual bookmark state transitions only')
assert(migration.includes("THEN 'SAVE'::TEXT ELSE 'UNSAVE'::TEXT"), 'profile evidence vocabulary must map only to SAVE/UNSAVE')
assert(migration.includes("r.status = 'published'"), 'ranking profile features must resolve only against current public rankings')
assert(migration.includes('private.is_public_item(e.item_id)'), 'item profile evidence must remain public-item bounded')
assert(migration.includes('TO authenticated'), 'profile read RPC must be authenticated-only')
assert(!migration.includes('content_like_events'), 'RF-1C must not invent LIKE as an RF-1 behavior event')
assert(!migration.includes('product_usage_events'), 'RF-1C must not promote MEASURE-1 anonymous telemetry into authenticated profile authority')
assert(!migration.includes('viewer_key_hash'), 'RF-1C must not copy anonymous viewer identity into the user profile contract')

assert(adapterSource.includes("row.event_type !== 'SAVE' && row.event_type !== 'UNSAVE'"), 'profile adapter must reject behavior events outside SAVE/UNSAVE')
assert(adapterSource.includes("features.push({ kind: 'category'"), 'ranking SAVE/UNSAVE must attribute category')
assert(adapterSource.includes("features.push({ kind: 'rankingType'"), 'ranking SAVE/UNSAVE must attribute ranking type')
assert(adapterSource.includes("features.push({ kind: 'subcategory'"), 'ranking SAVE/UNSAVE must attribute subcategory when present')
assert(adapterSource.includes("features.push({ kind: 'item'"), 'profile adapter must attribute governed item affinity')
assert(adapterSource.includes('recommendationRunId: null'), 'current bookmark events must not fabricate recommendation attribution')
assert(adapterSource.includes('exposureId: null'), 'current bookmark events must not fabricate exposure attribution')

assert(profileServerSource.includes('supabase.auth.getUser()'), 'profile server must determine authenticated presence from the server session')
assert(profileServerSource.includes('if (authError || !authData.user) return []'), 'anonymous users must deterministically fall back to an empty long-term profile')
assert(profileServerSource.includes("supabase.rpc('get_rf1_my_profile_events'"), 'authenticated profile data must flow through the governed RPC')

assert(shadowSource.includes("mode: 'SHADOW'"), 'RF-1C execution must be explicitly SHADOW-only')
assert(shadowSource.includes('getRelatedRankings(input.currentRanking)'), 'SHADOW must start from the existing related-ranking candidate authority')
assert(shadowSource.includes('loadOptionalMyRf1ProfileEvents'), 'SHADOW must consume real authenticated profile evidence when available')
assert(shadowSource.includes('buildRf1BehaviorProfile'), 'SHADOW must build the RF-1 long-term profile deterministically')
assert(shadowSource.includes('buildRf1SessionInterest'), 'SHADOW must allow ephemeral in-memory session events')
assert(shadowSource.includes('rankRf1Feed'), 'SHADOW must execute the RF-1 ranking core')
assert(shadowSource.includes('mergeRf1RelatedRankingResult'), 'SHADOW must restore IA-2 protected-prefix authority')
assert(shadowSource.includes('baselineRankingIds'), 'SHADOW must retain the current baseline order for comparison')
assert(shadowSource.includes('changedPositionCount'), 'SHADOW must expose deterministic order-delta evidence')
assert(!shadowSource.includes('recordRf1RelatedExposureRecords'), 'SHADOW must not persist actual-exposure evidence because results were not shown')
assert(!shadowSource.includes('createRf1RelatedExposureRecords'), 'SHADOW must not fabricate exposure rows')
assert(!shadowSource.includes('RF1_POLICY'), 'SHADOW must not ship an uncalibrated production policy constant')
assert(!rankingPageSource.includes('runRf1RelatedShadow'), 'RF-1C must not activate SHADOW execution from the public ranking page yet')

const transpiled = ts.transpileModule(adapterSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    strict: true,
  },
  fileName: profileAdapterPath,
}).outputText
assert(!transpiled.includes("from './rf1-core'"), 'profile adapter runtime must have no dependency after type-only import erasure')
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
const adapter = await import(moduleUrl)

const events = adapter.adaptRf1ProfileEventRows([
  {
    event_id: 'bookmark:10',
    event_type: 'SAVE',
    occurred_at: '2026-08-24T01:00:00.000Z',
    ranking_id: 'ranking-1',
    item_id: null,
    category_id: 'category-1',
    subcategory_id: 'subcategory-1',
    ranking_type: 'editorial',
    ranking_item_ids: ['item-2', 'item-1', 'item-1'],
  },
  {
    event_id: 'bookmark:11',
    event_type: 'UNSAVE',
    occurred_at: '2026-08-24T02:00:00.000Z',
    ranking_id: null,
    item_id: 'item-9',
    category_id: null,
    subcategory_id: null,
    ranking_type: null,
    ranking_item_ids: [],
  },
])

assert(events.length === 2, 'all governed profile rows must adapt')
assert(events[0].eventType === 'SAVE' && events[0].magnitude === 1, 'SAVE transition must retain exact RF-1 event type and normalized magnitude')
assert(events[0].features.map((feature) => `${feature.kind}:${feature.id}`).join(',') === 'category:category-1,item:item-1,item:item-2,rankingType:editorial,subcategory:subcategory-1', 'ranking profile features must be deterministic, governed, and deduplicated')
assert(events[0].recommendationRunId === null && events[0].exposureId === null, 'profile adapter must not invent missing outcome attribution')
assert(events[1].eventType === 'UNSAVE' && events[1].features.length === 1 && events[1].features[0].id === 'item-9', 'item UNSAVE must map only to the governed item feature')

expectThrow(() => adapter.adaptRf1ProfileEventRows([
  {
    event_id: 'bookmark:bad',
    event_type: 'LIKE',
    occurred_at: '2026-08-24T01:00:00.000Z',
    ranking_id: null,
    item_id: 'item-1',
    category_id: null,
    subcategory_id: null,
    ranking_type: null,
    ranking_item_ids: [],
  },
]), 'unsupported profile event vocabulary must fail closed')

expectThrow(() => adapter.adaptRf1ProfileEventRows([
  {
    event_id: 'bookmark:dup', event_type: 'SAVE', occurred_at: '2026-08-24T01:00:00.000Z',
    ranking_id: null, item_id: 'item-1', category_id: null, subcategory_id: null, ranking_type: null, ranking_item_ids: [],
  },
  {
    event_id: 'bookmark:dup', event_type: 'UNSAVE', occurred_at: '2026-08-24T02:00:00.000Z',
    ranking_id: null, item_id: 'item-1', category_id: null, subcategory_id: null, ranking_type: null, ranking_item_ids: [],
  },
]), 'duplicate profile event IDs must fail closed')

console.log('RF-1C profile evidence and SHADOW contracts: PASS')
