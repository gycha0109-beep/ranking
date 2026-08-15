import { createHash } from 'node:crypto'
import type { RankingBrowseSort, SearchKind, SearchSort } from './contracts'

type SearchCursorPayload = {
  v: 1
  fp: string
  relevance?: number
  views?: number
  likes?: number
  time: string
  kind: 'ranking' | 'item'
  id: string
}

type RankingCursorPayload = {
  v: 1
  fp: string
  views?: number
  likes?: number
  time: string
  id: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function fingerprint(parts: unknown[]) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('base64url').slice(0, 24)
}

function encode(payload: SearchCursorPayload | RankingCursorPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decode<T extends object>(value: string | undefined): T | null {
  if (!value || value.length > 2048) return null

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as T
  } catch {
    return null
  }
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 64
    && Number.isFinite(Date.parse(value))
}

function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function createSearchFingerprint(
  query: string,
  kind: SearchKind,
  sort: SearchSort,
  facetIds: string[] = []
) {
  const parts: unknown[] = ['p1-3-search-v1', query, kind, sort]
  if (facetIds.length > 0) parts.push('p1-4-facets-v1', facetIds)
  return fingerprint(parts)
}

export function encodeSearchCursor(args: {
  fingerprint: string
  sort: SearchSort
  row: {
    relevance_score: number
    unique_view_count: number
    like_count: number
    sort_time: string
    content_kind: 'ranking' | 'item'
    id: string
  }
}) {
  const payload: SearchCursorPayload = {
    v: 1,
    fp: args.fingerprint,
    time: args.row.sort_time,
    kind: args.row.content_kind,
    id: args.row.id,
  }

  if (args.sort === 'relevance') payload.relevance = args.row.relevance_score
  if (args.sort === 'popular') {
    payload.views = args.row.unique_view_count
    payload.likes = args.row.like_count
  }

  return encode(payload)
}

export function decodeSearchCursor(
  value: string | undefined,
  expectedFingerprint: string,
  sort: SearchSort
): SearchCursorPayload | null {
  const payload = decode<SearchCursorPayload>(value)

  if (
    !payload
    || payload.v !== 1
    || payload.fp !== expectedFingerprint
    || !isValidTimestamp(payload.time)
    || !isValidUuid(payload.id)
    || !['ranking', 'item'].includes(payload.kind)
  ) {
    return null
  }

  if (sort === 'relevance' && !isNonNegativeSafeInteger(payload.relevance)) return null
  if (sort === 'popular' && (
    !isNonNegativeSafeInteger(payload.views)
    || !isNonNegativeSafeInteger(payload.likes)
  )) return null

  return payload
}

export function createRankingBrowseFingerprint(
  categorySlug: string,
  subcategorySlug: string | null,
  sort: RankingBrowseSort,
  facetIds: string[] = []
) {
  const parts: unknown[] = ['p1-3-ranking-browse-v1', categorySlug, subcategorySlug, sort]
  if (facetIds.length > 0) parts.push('p1-4-facets-v1', facetIds)
  return fingerprint(parts)
}

export function encodeRankingBrowseCursor(args: {
  fingerprint: string
  sort: RankingBrowseSort
  row: {
    unique_view_count: number
    like_count: number
    sort_time: string
    id: string
  }
}) {
  const payload: RankingCursorPayload = {
    v: 1,
    fp: args.fingerprint,
    time: args.row.sort_time,
    id: args.row.id,
  }

  if (args.sort === 'popular') {
    payload.views = args.row.unique_view_count
    payload.likes = args.row.like_count
  }

  return encode(payload)
}

export function decodeRankingBrowseCursor(
  value: string | undefined,
  expectedFingerprint: string,
  sort: RankingBrowseSort
): RankingCursorPayload | null {
  const payload = decode<RankingCursorPayload>(value)

  if (
    !payload
    || payload.v !== 1
    || payload.fp !== expectedFingerprint
    || !isValidTimestamp(payload.time)
    || !isValidUuid(payload.id)
  ) {
    return null
  }

  if (sort === 'popular' && (
    !isNonNegativeSafeInteger(payload.views)
    || !isNonNegativeSafeInteger(payload.likes)
  )) return null

  return payload
}
