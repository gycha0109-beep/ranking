import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const migrationDir = join(root, 'supabase', 'migrations')
const migrationNamePattern = /^(\d{14})_([a-z0-9_]+)\.sql$/

const requiredPhases = [
  ['P1-2.1 likes', /p1_2_1_(content_likes|likes_)/],
  ['P1-2.2 bookmarks', /p1_2_2_(content_bookmarks|bookmarks?)/],
  ['P1-2.3 views', /p1_2_3_(daily_unique_views|views?)/],
  ['P1-2.4 comments', /p1_2_4_comments?_schema/],
  ['P1-2.5 reports', /p1_2_5_comment_reports?_schema/],
  ['P1-2.6 notifications', /p1_2_6_notifications?_schema/],
  ['P1-2.7 sanctions', /p1_2_7_user_sanctions?_schema/],
  ['P1-2.8 access control', /p1_2_8_admin_role_capabilities/],
  ['P1-2.9 maintenance', /p1_2_9_maintenance_core/],
  ['P1-2.10 audit', /p1_2_10_audit_stream/],
  ['P1-2.11 security telemetry', /p1_2_11_admin_security_events/],
]

const securitySignals = [
  ['P1-2.1 likes', /p1_2_1_/, ['ENABLE ROW LEVEL SECURITY', 'REVOKE', 'SECURITY DEFINER']],
  ['P1-2.2 bookmarks', /p1_2_2_/, ['ENABLE ROW LEVEL SECURITY', 'REVOKE', 'SECURITY DEFINER']],
  ['P1-2.4 comments', /p1_2_4_/, ['REVOKE', 'SECURITY DEFINER']],
  ['P1-2.5 reports', /p1_2_5_/, ['ENABLE ROW LEVEL SECURITY', 'REVOKE', 'SECURITY DEFINER']],
  ['P1-2.6 notifications', /p1_2_6_/, ['ENABLE ROW LEVEL SECURITY', 'REVOKE', 'SECURITY DEFINER']],
  ['P1-2.7 sanctions', /p1_2_7_/, ['ENABLE ROW LEVEL SECURITY', 'REVOKE', 'SECURITY DEFINER']],
  ['P1-2.8 access control', /p1_2_8_/, ['REVOKE', 'SECURITY DEFINER']],
  ['P1-2.10 audit', /p1_2_10_/, ['REVOKE', 'SECURITY DEFINER']],
  ['P1-2.11 security telemetry', /p1_2_11_/, ['ENABLE ROW LEVEL SECURITY', 'REVOKE', 'SECURITY DEFINER']],
]

const files = (await readdir(migrationDir)).filter((file) => file.endsWith('.sql')).sort()
const failures = []
const timestamps = new Map()
const names = new Map()
const migrations = []

for (const file of files) {
  const match = migrationNamePattern.exec(file)
  if (!match) {
    failures.push(`invalid migration filename: ${file}`)
    continue
  }

  const [, timestamp, name] = match
  if (timestamps.has(timestamp)) {
    failures.push(`duplicate migration timestamp ${timestamp}: ${timestamps.get(timestamp)}, ${file}`)
  } else {
    timestamps.set(timestamp, file)
  }

  if (names.has(name)) {
    failures.push(`duplicate migration name ${name}: ${names.get(name)}, ${file}`)
  } else {
    names.set(name, file)
  }

  const content = await readFile(join(migrationDir, file), 'utf8')
  migrations.push({ file, name, content })
}

for (const [label, pattern] of requiredPhases) {
  if (!migrations.some(({ name }) => pattern.test(name))) {
    failures.push(`missing required migration phase: ${label}`)
  }
}

const p12Migrations = migrations.filter(({ name }) => /^p1_2_/.test(name))
for (const migration of p12Migrations) {
  const upper = migration.content.toUpperCase()
  const hasTransaction = /\bBEGIN\s*;/.test(upper) && /\bCOMMIT\s*;/.test(upper)
  const explicitException = upper.includes('MIGRATION_TRANSACTION_EXCEPTION')
  if (!hasTransaction && !explicitException) {
    failures.push(`missing transaction boundary or exception marker: ${migration.file}`)
  }
}

for (const [label, pattern, signals] of securitySignals) {
  const combined = migrations
    .filter(({ name }) => pattern.test(name))
    .map(({ content }) => content.toUpperCase())
    .join('\n')

  for (const signal of signals) {
    if (!combined.includes(signal)) failures.push(`${label} missing security signal: ${signal}`)
  }
}

const workflow = await readFile(join(root, '.github', 'workflows', 'ci.yml'), 'utf8')
if (!workflow.includes('npm run verify:p1-2')) {
  failures.push('CI does not run npm run verify:p1-2')
}

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
if (packageJson.scripts?.['verify:p1-2'] !== 'node scripts/verify-p1-2-contracts.mjs') {
  failures.push('package.json verify:p1-2 script is missing or changed')
}

if (failures.length > 0) {
  console.error('P1-2 contract verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`P1-2 contract verification passed: ${p12Migrations.length} P1-2 migrations, ${files.length} total migrations.`)
