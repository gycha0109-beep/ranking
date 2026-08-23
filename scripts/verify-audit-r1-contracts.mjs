import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const ci = read('.github/workflows/ci.yml')
const ingress = read('.github/workflows/main-ingress-audit.yml')

const failures = []
const requireText = (source, text, label) => {
  if (!source.includes(text)) failures.push(`${label}: missing ${JSON.stringify(text)}`)
}

for (const required of [
  'name: CI',
  'pull_request:',
  'jobs:',
  '  validate:',
  'npm run verify:audit-r1',
]) {
  requireText(ci, required, 'CI workflow')
}

for (const required of [
  'name: Main Ingress Audit',
  'push:',
  '      - main',
  'contents: read',
  'pull-requests: read',
  'verify-merged-pr-ingress:',
  'actions/github-script@v7',
  'listPullRequestsAssociatedWithCommit',
  "pr.base?.ref === 'main'",
  'pr.merged_at',
  'pr.merge_commit_sha === sha',
  'currently missing an enforced branch protection rule',
]) {
  requireText(ingress, required, 'main ingress audit workflow')
}

if (failures.length) {
  console.error('AUDIT-R1 contract verification failed')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('AUDIT-R1 contract verification passed')
