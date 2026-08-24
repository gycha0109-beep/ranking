import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migrationPath = path.join(root, 'supabase/migrations/20260824070000_rf_1e_outcome_attribution_bridge.sql')
const adapterPath = path.join(root, 'src/lib/recommendation/rf1-related-adapter.ts')
const serverPath = path.join(root, 'src/lib/recommendation/rf1-related-server.ts')
const routePath = path.join(root, 'src/app/api/measure-1/route.ts')
const telemetryPath = path.join(root, 'src/components/telemetry/ProductTelemetry.tsx')
const rankingPagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')

function fail(message) {
  console.error(`RF-1E contract failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

for (const requiredPath of [migrationPath, adapterPath, serverPath, routePath, telemetryPath, rankingPagePath]) {
  assert(fs.existsSync(requiredPath), `${path.relative(root, requiredPath)} must exist`)
}

const migration = fs.readFileSync(migrationPath, 'utf8')
const adapter = fs.readFileSync(adapterPath, 'utf8')
const server = fs.readFileSync(serverPath, 'utf8')
const route = fs.readFileSync(routePath, 'utf8')
const telemetry = fs.readFileSync(telemetryPath, 'utf8')
const rankingPage = fs.readFileSync(rankingPagePath, 'utf8')

assert(migration.includes('ADD COLUMN source_ranking_id UUID'), 'exposure evidence must add exact source-ranking provenance')
assert(migration.includes('ALTER COLUMN source_ranking_id SET NOT NULL'), 'source-ranking provenance must be mandatory before activation')
assert(migration.includes('RF-1E cannot infer source_ranking_id for pre-existing exposure rows'), 'unknown historical source provenance must fail closed rather than be inferred')
assert(migration.includes('source_ranking_id <> ranking_id'), 'RF-1 exposure must reject self-target source/target pairs')
assert(migration.includes('e.source_ranking_id = v_source_ranking_id'), 'exposure replay equality must include source ranking provenance')
assert(migration.includes('RF-1 exposure source ranking is not public'), 'exposure writer must validate source ranking publication/moderation')
assert(migration.includes('RF-1 exposure target ranking is not public'), 'exposure writer must validate target ranking publication/moderation')

assert(migration.includes('ADD COLUMN recommendation_exposure_id TEXT'), 'MEASURE-1 rows must accept only an optional RF-1 correlation pointer')
assert(migration.includes("event_type = 'content_discovery_click'"), 'RF-1 outcome correlation must stay on the existing MEASURE-1 click event type')
assert(migration.includes("discovery_source = 'related_ranking'"), 'RF-1 outcome correlation must stay on the existing related_ranking discovery source')
assert(migration.includes('CREATE OR REPLACE FUNCTION public.record_rf1_related_discovery_click'), 'RF-1E atomic bridge RPC must exist')
assert(migration.includes('SELECT public.record_product_usage_event('), 'RF-1E bridge must delegate event creation to the existing MEASURE-1 writer authority')
assert(migration.includes('v_exposure.ranking_id IS DISTINCT FROM p_ranking_id'), 'bridge must require exact exposure target match')
assert(migration.includes('v_exposure.source_ranking_id IS DISTINCT FROM p_source_ranking_id'), 'bridge must require exact exposure source match')
assert(migration.includes('v_exposure.exposed_at > v_event.occurred_at'), 'bridge must reject clicks that precede exposure')
assert(migration.includes('already has a conflicting RF-1 exposure attribution'), 'bridge replay must fail closed on conflicting attribution')
assert(migration.includes('recommendation_exposure_id = p_exposure_id'), 'bridge must persist the exact opaque exposure correlation')
assert(migration.includes('rf1_attributed_related_ranking_clicks'), 'readiness must distinguish exact RF-1-attributed outcomes from generic related clicks')
assert(migration.includes('v_attributed_related_ranking_clicks = 0'), 'RF-1 outcome readiness must depend on exact attributed clicks')
assert(migration.includes("'production_policy_authorized', FALSE"), 'RF-1E must not authorize a production policy automatically')
assert(migration.includes("'automatic_authorization', 'FORBIDDEN'"), 'RF-1E must retain automatic-authorization prohibition')
assert(!migration.includes('CREATE TABLE public.rf1_recommendation_outcomes'), 'RF-1E must not create a duplicate recommendation-outcome analytics table')
assert(!migration.includes('ADD COLUMN user_id'), 'RF-1E must not add a second authenticated-user analytics identity')
assert(!migration.includes('ADD COLUMN viewer_key_hash'), 'RF-1E must not duplicate MEASURE-1 viewer identity')
assert(!migration.includes("'RF1_CLICK'"), 'RF-1E must not invent a new telemetry event type')
assert(!migration.includes("'rf1_related_ranking'"), 'RF-1E must not invent a new discovery-source vocabulary')
assert(migration.includes('GRANT EXECUTE ON FUNCTION public.record_rf1_related_discovery_click('), 'attribution bridge must have an explicit execution grant')
assert(migration.includes(') TO service_role;'), 'RF-1E write/read bridge must remain service-role controlled')

assert(adapter.includes('sourceRankingId: string'), 'TypeScript exposure contract must require sourceRankingId')
assert(adapter.includes('sourceRankingId: input.sourceRankingId'), 'created exposure evidence must retain source ranking')
assert(adapter.includes('source ranking must differ from target ranking'), 'adapter must fail closed on a self-target exposure')
assert(server.includes('source_ranking_id: record.sourceRankingId'), 'server RPC payload must serialize source ranking provenance')

assert(route.includes("admin.rpc('record_product_usage_event'"), 'ordinary MEASURE-1 events must continue using the existing writer')
assert(route.includes("admin.rpc('record_rf1_related_discovery_click'"), 'only exact attributed clicks may use the RF-1E wrapper')
assert(route.includes("source.discoverySource !== 'related_ranking'"), 'route must reject RF-1 exposure IDs on non-related discovery paths')
assert(route.includes('recommendationExposureId'), 'route must accept the optional opaque correlation token')
assert(telemetry.includes('anchor.dataset.rf1ExposureId'), 'client may forward an exposure ID only when rendered on the clicked anchor')
assert(!telemetry.includes('recommendationExposureId: eventId()'), 'client must never fabricate an RF-1 exposure ID')

assert(!rankingPage.includes('data-rf1-exposure-id'), 'RF-1E must not activate attributed recommendation links on the public ranking page')
assert(!rankingPage.includes('runRf1RelatedShadow'), 'public ranking page must remain outside RF-1 SHADOW/runtime execution')

console.log('RF-1E exact outcome-attribution bridge contracts: PASS')
