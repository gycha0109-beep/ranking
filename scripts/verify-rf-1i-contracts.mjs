import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migrationPath = path.join(root, 'supabase/migrations/20260824080000_rf_1i_related_visibility_measurement.sql')
const routePath = path.join(root, 'src/app/api/measure-1/route.ts')
const telemetryPath = path.join(root, 'src/components/telemetry/ProductTelemetry.tsx')
const rankingPagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')

function fail(message) {
  console.error(`RF-1I contract failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

for (const requiredPath of [migrationPath, routePath, telemetryPath, rankingPagePath]) {
  assert(fs.existsSync(requiredPath), `${path.relative(root, requiredPath)} must exist`)
}

const migration = fs.readFileSync(migrationPath, 'utf8')
const route = fs.readFileSync(routePath, 'utf8')
const telemetry = fs.readFileSync(telemetryPath, 'utf8')
const rankingPage = fs.readFileSync(rankingPagePath, 'utf8')

assert(migration.includes('ALTER TABLE public.product_usage_events'), 'RF-1I must extend the existing MEASURE-1 event authority')
assert(!migration.includes('CREATE TABLE public.rf1_behavior_events'), 'RF-1I must not create a second RF-1 behavior analytics table')
assert(!migration.includes('CREATE TABLE public.rf1_visibility'), 'RF-1I must not create a separate visibility analytics authority')
assert(migration.includes("'content_impression'"), 'MEASURE-1 must store a raw impression observation event')
assert(migration.includes("'content_visibility'"), 'MEASURE-1 must store a raw visibility-duration event')
assert(!migration.includes("'quick_skip'"), 'QUICK_SKIP must not be persisted as an uncalibrated judgment')
assert(!migration.includes("'dwell'"), 'DWELL must not be persisted as an uncalibrated judgment')
assert(migration.includes('observation_id UUID'), 'raw observation segments require an opaque correlation id')
assert(migration.includes('visible_duration_ms BIGINT'), 'raw visible duration must be retained without classification')
assert(migration.includes('entry_intersection_ratio_ppm INTEGER'), 'entry visibility geometry must remain an observed fact')
assert(migration.includes('visibility_end_reason TEXT'), 'visibility termination provenance must be explicit')
assert(migration.includes("visibility_end_reason IN ('out_of_view', 'page_hidden', 'page_exit', 'unmount')"), 'visibility end reasons must remain bounded')
assert(migration.includes("discovery_source = 'related_ranking'"), 'RF-1I raw observation scope must remain related-ranking only')
assert(migration.includes('RF-1I raw visibility is limited to related ranking-to-ranking observations'), 'DB writer must fail closed outside the related-ranking surface')
assert(migration.includes('source_ranking_id IS NOT NULL'), 'related visibility must retain source ranking identity')
assert(migration.includes('ranking_id IS NOT NULL'), 'related visibility must retain target ranking identity')
assert(migration.includes('uq_product_usage_related_observation_event'), 'one raw event per observation/type must be idempotently bounded')
assert(migration.includes("event_type IN ('content_impression', 'content_visibility', 'content_discovery_click')"), 'observation correlation must connect impression/visibility/click')
assert(migration.includes('p_observation_id UUID DEFAULT NULL'), 'MEASURE-1 writer must accept bounded observation correlation')
assert(migration.includes('p_visible_duration_ms BIGINT DEFAULT NULL'), 'MEASURE-1 writer must accept raw duration')
assert(migration.includes('p_recommendation_exposure_id TEXT DEFAULT NULL'), 'raw observation can retain exact RF-1 exposure provenance when present')
assert(migration.includes('v_exposure.ranking_id IS DISTINCT FROM p_ranking_id'), 'RF-1 exposure correlation must still validate exact target')
assert(migration.includes('v_exposure.source_ranking_id IS DISTINCT FROM p_source_ranking_id'), 'RF-1 exposure correlation must still validate exact source')
assert(migration.includes('DROP FUNCTION public.record_rf1_related_discovery_click('), 'old RF-1E wrapper signature must be removed to avoid overload ambiguity')
assert(migration.includes('p_observation_id UUID DEFAULT NULL'), 'RF-1E click wrapper must carry observation correlation')
assert(migration.includes('TO service_role'), 'MEASURE-1 write boundary must remain service-role-only')
assert(!migration.includes('ADD COLUMN user_id'), 'RF-1I must not create a second authenticated identity authority')
assert(!migration.includes('ADD COLUMN viewer_key_hash'), 'RF-1I must reuse existing MEASURE-1 viewer hash')
assert(!migration.toLowerCase().includes('ip_address'), 'RF-1I must not collect raw IP')
assert(!migration.toLowerCase().includes('user_agent'), 'RF-1I must not collect user-agent fingerprints')

assert(route.includes("kind === 'related_ranking_impression' || kind === 'related_ranking_visibility'"), 'API must accept only explicit raw related-ranking observation kinds')
assert(route.includes("args.p_event_type = kind === 'related_ranking_impression' ? 'content_impression' : 'content_visibility'"), 'API must map browser observation to raw MEASURE-1 events')
assert(route.includes('normalizeNonNegativeSafeInteger(body.visibleDurationMs)'), 'duration must be validated as a raw non-negative safe integer')
assert(route.includes('normalizeIntersectionRatioPpm(body.entryIntersectionRatioPpm)'), 'entry intersection geometry must be bounded')
assert(route.includes("source.discoverySource !== 'related_ranking'"), 'RF-1 correlation must remain restricted to related-ranking paths')
assert(route.includes('p_observation_id: args.p_observation_id'), 'attributed click wrapper must retain observation correlation')
assert(!route.includes('quickSkip'), 'API must not derive QUICK_SKIP')
assert(!route.includes('dwellMagnitude'), 'API must not derive DWELL magnitude')

assert(telemetry.includes('new IntersectionObserver'), 'browser must use viewport observation rather than DOM render as impression evidence')
assert(telemetry.includes('entry.isIntersecting && entry.intersectionRatio > 0'), 'impression must require positive visible intersection')
assert(telemetry.includes('{ threshold: 0 }'), 'RF-1I must not introduce a product-policy visibility threshold')
assert(telemetry.includes("kind: 'related_ranking_impression'"), 'browser must emit raw impression')
assert(telemetry.includes("kind: 'related_ranking_visibility'"), 'browser must emit raw visibility duration')
assert(telemetry.includes('performance.now() - state.startedAt'), 'duration must use monotonic browser timing')
assert(telemetry.includes("finishAll('page_hidden')"), 'background-tab time must not be counted as visible duration')
assert(telemetry.includes("finishAll('page_exit')"), 'page exit must close active observation segments')
assert(telemetry.includes("finishAll('unmount')"), 'route unmount must close active observation segments')
assert(telemetry.includes('anchor.dataset.measureObservationId = observationId'), 'active observation id must be available to the click telemetry path')
assert(telemetry.includes('const observationId = anchor.dataset.measureObservationId'), 'click must reuse the active raw observation id when present')
assert(!telemetry.includes('QUICK_SKIP_THRESHOLD'), 'browser must not classify quick skips')
assert(!telemetry.includes('DWELL_THRESHOLD'), 'browser must not classify dwell')

assert(!rankingPage.includes('runRf1RelatedShadow'), 'public ranking page must still not activate RF-1 ordering')
assert(!rankingPage.includes('data-rf1-exposure-id'), 'RF-1I must not activate user-visible RF-1 exposures')

console.log('RF-1I raw related-ranking visibility instrumentation contracts: PASS')
