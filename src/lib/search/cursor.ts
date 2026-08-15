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

function fingerprint(parts: unknown[]) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('base64url').slice(0, 24)
}

function encode(payload: SearchCursorPayload | RankingCursorPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decode<T>(value: string | undefined): T | null {
  if (!value || value.length > 2048) return null

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T
    return parsed
  } catch {
    return null
  }
}

export function createSearchFingerprint(query: string, kind: SearchKind, sort: SearchSort) {
  return fingerprint(['p1-3-search-v1', query, kind, sort])
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
    || !payload.time
    || !payload.id
    || !['ranking', 'item'].includes(payload.kind)
  ) {
    return null
  }

  if (sort === 'relevance' && !Number.isInteger(payload.relevance)) return null
  if (sort === 'popular' && (!Number.isFinite(payload.views) || !Number.isFinite(payload.likes))) return null

  return payload
}

export function createRankingBrowseFingerprint(
  categorySlug: string,
  subcategorySlug: string | null,
  sort: RankingBrowseSort
) {
  return fingerprint(['p1-3-ranking-browse-v1', categorySlug, subcategorySlug, sort])
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

  if (!payload || payload.v !== 1 || payload.fp !== expectedFingerprint || !payload.time || !payload.id) {
    return null
  }

  if (sort === 'popular' && (!Number.isFinite(payload.views) || !Number.isFinite(payload.likes))) return null

  return payload
}
