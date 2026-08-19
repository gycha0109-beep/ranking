import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const requireText = (content, text, label) => {
  if (!content.includes(text)) throw new Error(`MEASURE-1 contract missing: ${label}`)
}
const forbidText = (content, text, label) => {
  if (content.includes(text)) throw new Error(`MEASURE-1 forbidden contract present: ${label}`)
}

const migrationPath = 'supabase/migrations/20260819043000_measure_1_product_usage_discovery.sql'
const retentionMigrationPath = 'supabase/migrations/20260819043100_measure_1_retention_maintenance.sql'
const routePath = 'src/app/api/measure-1/route.ts'
const clientPath = 'src/components/telemetry/ProductTelemetry.tsx'
const adminPath = 'src/app/admin/measure/page.tsx'
const docsPath = 'docs/measure-1-product-usage-discovery-baseline.md'

for (const file of [migrationPath, retentionMigrationPath, routePath, clientPath, adminPath, docsPath]) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`MEASURE-1 file missing: ${file}`)
}

const migration = read(migrationPath)
for (const eventType of ['content_view', 'search', 'search_result_click', 'content_discovery_click']) {
  requireText(migration, `'${eventType}'`, `bounded event ${eventType}`)
}
for (const source of ['home', 'category', 'search', 'related_ranking', 'ranking_item', 'item_ranking']) {
  requireText(migration, `'${source}'`, `discovery source ${source}`)
}
requireText(migration, "traffic_class IN ('unknown', 'qa_internal')", 'traffic classification')
requireText(migration, 'viewer_key_hash', 'daily viewer hash')
requireText(migration, 'uq_product_usage_content_view_daily_ranking', 'ranking daily dedupe index')
requireText(migration, "WHERE event_type = 'content_view' AND ranking_id IS NOT NULL", 'ranking dedupe partial predicate')
requireText(migration, 'uq_product_usage_content_view_daily_item', 'item daily dedupe index')
requireText(migration, "WHERE event_type = 'content_view' AND item_id IS NOT NULL", 'item dedupe partial predicate')
forbidText(migration, 'ON public.product_usage_events(viewer_key_hash, occurred_on, ranking_id, item_id)', 'NULL-sensitive combined view dedupe')
requireText(migration, "query_text IS NULL OR char_length(query_text) BETWEEN 2 AND 80", 'query text bound')
requireText(migration, "WHEN 'category' THEN source_category_id IS NOT NULL", 'canonical category source identity')
requireText(migration, "WHEN 'related_ranking' THEN source_ranking_id IS NOT NULL", 'canonical ranking source identity')
requireText(migration, "WHEN 'item_ranking' THEN source_item_id IS NOT NULL", 'canonical item source identity')
requireText(migration, "INTERVAL '30 days'", 'query text retention')
requireText(migration, "INTERVAL '13 months'", 'event retention')
requireText(migration, 'ENABLE ROW LEVEL SECURITY', 'RLS')
requireText(migration, 'REVOKE ALL ON TABLE public.product_usage_events FROM PUBLIC, anon, authenticated', 'direct table write denial')
requireText(migration, 'TO service_role', 'service-role write boundary')
requireText(migration, "public.has_admin_capability('audit_view')", 'admin baseline visibility boundary')
requireText(migration, 'v_baseline_started_at TIMESTAMPTZ', 'measurement epoch')
requireText(migration, 'GREATEST(p_from::TIMESTAMPTZ, v_baseline_started_at)', 'legacy engagement exclusion')
requireText(migration, "baseline_eligible', FALSE", 'legacy view exclusion')
forbidText(migration.toLowerCase(), 'ip_address', 'raw IP column')
forbidText(migration.toLowerCase(), 'user_agent', 'user-agent fingerprint column')
forbidText(migration.toLowerCase(), 'referrer_url', 'raw referrer URL column')
forbidText(migration.toLowerCase(), 'metadata json', 'arbitrary metadata blob')

const retentionMigration = read(retentionMigrationPath)
requireText(retentionMigration, 'private.maintain_measure_1_telemetry_batch', 'maintenance batch adapter')
requireText(retentionMigration, "'maintain_measure_1_telemetry'", 'maintenance job definition')
requireText(retentionMigration, "'ranking-maint-measure-1-telemetry'", 'maintenance cron name')
requireText(retentionMigration, "'10 4 * * *'", 'daily maintenance schedule')
requireText(retentionMigration, "WHEN 'maintain_measure_1_telemetry' THEN", 'existing maintenance runner integration')
requireText(retentionMigration, "private.purge_measure_1_telemetry_batch(p_batch_size)", 'retention implementation reuse')
requireText(retentionMigration, "cron.schedule(", 'existing pg_cron scheduling')
requireText(retentionMigration, "private.run_maintenance_job('maintain_measure_1_telemetry', 'cron')", 'centralized runner dispatch')
forbidText(retentionMigration, 'CREATE TABLE public.maintenance_job_definitions', 'duplicate maintenance subsystem')

const route = read(routePath)
requireText(route, "const VIEWER_COOKIE = 'rw_viewer_v1'", 'existing anonymous viewer cookie reuse')
requireText(route, "createHmac('sha256'", 'HMAC hashing')
requireText(route, "explicitClass === 'qa_internal'", 'explicit QA metadata classification')
requireText(route, "email.endsWith('@example.com')", 'known production QA account classification')
requireText(route, 'SENSITIVE_QUERY_PATTERNS', 'sensitive query redaction')
requireText(route, 'query.length > 80', 'retained query length bound')
requireText(route, "new URL(origin).host !== request.nextUrl.host", 'same-origin write boundary')
requireText(route, "admin.rpc('record_product_usage_event'", 'bounded RPC write')
requireText(route, 'if (error || !data) return null', 'canonical discovery source fail-closed')
forbidText(route.toLowerCase(), "headers.get('user-agent')", 'user-agent collection')
forbidText(route.toLowerCase(), "headers.get('x-forwarded-for')", 'IP collection')
forbidText(route.toLowerCase(), 'document.referrer', 'raw referrer collection')

const client = read(clientPath)
requireText(client, "kind: 'content_view'", 'content view measurement')
requireText(client, "kind: 'search'", 'search measurement')
requireText(client, "kind: 'search_result_click'", 'search click measurement')
requireText(client, "kind: 'content_discovery_click'", 'internal discovery measurement')
requireText(client, 'resultLinks().length', 'search result count')
requireText(client, 'selectedPosition: position', 'search result position')
requireText(client, 'keepalive: true', 'navigation-safe event delivery')

const layout = read('src/app/layout.tsx')
requireText(layout, "@/components/telemetry/ProductTelemetry", 'global telemetry mount')
requireText(layout, '<ProductTelemetry />', 'global telemetry component')

const admin = read(adminPath)
requireText(admin, 'Known QA exclusion', 'QA visibility')
requireText(admin, 'Zero-result rate', 'zero-result visibility')
requireText(admin, 'Search CTR', 'CTR visibility')
requireText(admin, 'Discovery sources', 'discovery source visibility')
requireText(admin, 'Returning-user KPI', 'returning-user limitation')

const packageJson = JSON.parse(read('package.json'))
if (packageJson.scripts?.['verify:measure-1'] !== 'node scripts/verify-measure-1-contracts.mjs') {
  throw new Error('MEASURE-1 package verifier script is missing')
}
const ci = read('.github/workflows/ci.yml')
requireText(ci, 'npm run verify:measure-1', 'CI verifier gate')

console.log('MEASURE-1 contract verification passed.')
