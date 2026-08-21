import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
const INDEXNOW_KEY_FILE = '0fc5987ce02e929b5fcd9b1223ae985e81fd8c41e9d2dc381513970419411722.txt'
const MAX_URLS = 10_000

function fail(message) {
  console.error(`IndexNow submission error: ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const parsed = { site: process.env.NEXT_PUBLIC_SITE_URL?.trim() || '', urls: [], submit: false }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--submit') {
      parsed.submit = true
      continue
    }

    if (arg === '--site') {
      parsed.site = argv[index + 1] || ''
      index += 1
      continue
    }

    if (arg === '--url') {
      const value = argv[index + 1]
      if (!value) fail('--url requires a value')
      parsed.urls.push(value)
      index += 1
      continue
    }

    fail(`unknown argument: ${arg}`)
  }

  return parsed
}

function normalizeOrigin(rawSite) {
  if (!rawSite) fail('--site or NEXT_PUBLIC_SITE_URL is required')

  let site
  try {
    site = new URL(rawSite)
  } catch {
    fail(`invalid site URL: ${rawSite}`)
  }

  if (!['https:', 'http:'].includes(site.protocol)) fail('site URL must use http or https')
  site.pathname = '/'
  site.search = ''
  site.hash = ''
  return site
}

function normalizeUrls(rawUrls, site) {
  if (rawUrls.length === 0) fail('at least one --url is required')
  if (rawUrls.length > MAX_URLS) fail(`at most ${MAX_URLS} URLs may be submitted per request`)

  const normalized = []
  const seen = new Set()

  for (const rawUrl of rawUrls) {
    let target
    try {
      target = new URL(rawUrl, site)
    } catch {
      fail(`invalid URL: ${rawUrl}`)
    }

    if (target.origin !== site.origin) fail(`URL does not belong to site host: ${rawUrl}`)
    if (!['https:', 'http:'].includes(target.protocol)) fail(`unsupported URL protocol: ${rawUrl}`)

    target.hash = ''
    const value = target.toString()
    if (!seen.has(value)) {
      seen.add(value)
      normalized.push(value)
    }
  }

  return normalized
}

function loadKey() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const keyPath = path.resolve(scriptDir, '..', 'public', INDEXNOW_KEY_FILE)
  const key = readFileSync(keyPath, 'utf8').trim()

  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) fail('IndexNow key file does not satisfy protocol syntax')
  if (`${key}.txt` !== INDEXNOW_KEY_FILE) fail('IndexNow key filename must match its contents')

  return key
}

const args = parseArgs(process.argv.slice(2))
const site = normalizeOrigin(args.site)
const urlList = normalizeUrls(args.urls, site)
const key = loadKey()
const keyLocation = new URL(`/${INDEXNOW_KEY_FILE}`, site).toString()
const payload = {
  host: site.host,
  key,
  keyLocation,
  urlList,
}

if (!args.submit) {
  console.log(JSON.stringify({ mode: 'DRY_RUN', endpoint: INDEXNOW_ENDPOINT, ...payload, urlCount: urlList.length }, null, 2))
  process.exit(0)
}

const response = await fetch(INDEXNOW_ENDPOINT, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
})

if (response.status === 200 || response.status === 202) {
  const state = response.status === 200 ? 'RECEIVED' : 'RECEIVED_KEY_VALIDATION_PENDING'
  console.log(JSON.stringify({ state, status: response.status, host: site.host, urlCount: urlList.length }, null, 2))
  process.exit(0)
}

const responseText = (await response.text()).slice(0, 500)
fail(`HTTP ${response.status}${responseText ? `: ${responseText}` : ''}`)
