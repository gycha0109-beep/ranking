import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260823070000_audit_r2_admin_security_event_trust_boundary.sql')
const adminAccess = read('src/lib/actions/admin-access.ts')
const securityActions = read('src/lib/actions/admin-security-events.ts')
const ci = read('.github/workflows/ci.yml')

const failures = []
const requireText = (source, text, label) => {
  if (!source.includes(text)) failures.push(`${label}: missing ${JSON.stringify(text)}`)
}

for (const required of [
  "CHECK (source_trust IN ('authenticated_self_report', 'trusted_server'))",
  'source_trust',
  'CREATE OR REPLACE FUNCTION private.record_admin_security_event_core(',
  'CREATE OR REPLACE FUNCTION public.record_trusted_admin_security_event(',
  "auth.role() IS DISTINCT FROM 'service_role'",
  "'authenticated_self_report'",
  "'trusted_server'",
  'AND bucket.source_trust = v_source_trust',
  'bucket.source_trust = v_source_trust',
  "WHERE bucket.source_trust = 'trusted_server'",
  'REVOKE ALL ON FUNCTION public.record_trusted_admin_security_event',
  'FROM PUBLIC, anon, authenticated;',
  'TO service_role;',
]) {
  requireText(migration, required, 'R2 migration')
}

const uniqueConstraint = migration.match(/ADD CONSTRAINT admin_security_event_buckets_aggregate_key UNIQUE \(([\s\S]*?)\);/)
if (!uniqueConstraint || !uniqueConstraint[1].includes('source_trust')) {
  failures.push('R2 migration: aggregate uniqueness must include source_trust')
}

for (const required of [
  "import { createAdminClient } from '@/lib/supabase/admin'",
  "type SecurityEventTrust = 'authenticated_self_report' | 'trusted_server'",
  "if (trust === 'trusted_server')",
  "admin.rpc('record_trusted_admin_security_event'",
  "await supabase.rpc('record_admin_security_event', event)",
  "}, 'trusted_server')",
]) {
  requireText(adminAccess, required, 'admin access actions')
}

const reportStart = adminAccess.indexOf('export async function reportAdminSecurityEvent')
const accessStart = adminAccess.indexOf('export async function getMyAdminAccess')
const reportBody = reportStart >= 0 && accessStart > reportStart
  ? adminAccess.slice(reportStart, accessStart)
  : ''
if (!reportBody.includes('recordAdminSecurityEventWithClient(supabase, context)') || reportBody.includes("'trusted_server'")) {
  failures.push('admin access actions: pre-validation/self-report path must remain untrusted')
}

requireText(securityActions, "rpc('record_admin_security_event'", 'security event self-report action')
requireText(ci, 'npm run verify:audit-r2', 'CI workflow')

if (failures.length) {
  console.error('AUDIT-R2 contract verification failed')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('AUDIT-R2 contract verification passed')
