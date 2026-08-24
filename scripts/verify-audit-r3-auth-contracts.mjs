import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const auth = read('src/lib/actions/auth.ts')
const login = read('src/app/login/LoginForm.tsx')
const ci = read('.github/workflows/ci.yml')
const failures = []

const requireText = (source, text, label) => {
  if (!source.includes(text)) failures.push(`${label}: missing ${JSON.stringify(text)}`)
}

for (const required of [
  "supabase.auth.signInWithPassword({ email, password })",
  "supabase.auth.signUp({",
  "case 'weak_password':",
  "case 'email_not_confirmed':",
  "case 'over_request_rate_limit':",
  "case 'over_email_send_rate_limit':",
  "case 'captcha_failed':",
]) {
  requireText(auth, required, 'auth server action')
}

for (const required of [
  "type=\"email\"",
  "type=\"password\"",
  "autoComplete={isLogin ? 'current-password' : 'new-password'}",
  "formData.append('password', password)",
]) {
  requireText(login, required, 'login/signup form')
}

requireText(ci, 'npm run verify:audit-r3', 'CI workflow')

if (failures.length) {
  console.error('AUDIT-R3 auth contract verification failed')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('AUDIT-R3 auth contract verification passed')
