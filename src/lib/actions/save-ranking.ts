'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type ModerationStatus = 'clean' | 'suggestive' | 'needs_review' | 'blocked'
type ModerationReason =
  | 'sexual_suggestive'
  | 'explicit_sexual'
  | 'minor_sexualization'
  | 'real_person_sexualization'
  | 'hate'
  | 'violence'
  | 'privacy'
  | 'illegal'
  | 'spam'
  | 'none'
  | 'system_error'

type ModerationTerm = {
  term: string
  severity: 'review' | 'block'
  category: ModerationReason
  match_mode: 'substring' | 'compact_substring'
}

type ModerationResult = {
  status: ModerationStatus
  reason: ModerationReason
}

type RankingData = {
  category_id: string
  subcategory_id?: string
  title: string
  slug: string
  summary: string
  body?: string
  ranking_type: string
  scope_json: Record<string, unknown>
  featured: boolean
  seo_title?: string
  seo_description?: string
  cover_image_url?: string
}

type CriterionInput = {
  id?: string
  name: string
  description?: string
  weight?: number
  sort_order: number
}

type SourceInput = {
  id?: string
  label: string
  url?: string
  source_type?: string
  note?: string
  is_public: boolean
}

type EntryInput = {
  id?: string
  item_id: string
  position: number
  reason: string
  editor_score?: number
  score_json?: Record<string, unknown>
  internal_note?: string
  sponsor_flag: boolean
}

function normalizeText(value: string): string {
  return value.normalize('NFKC').toLowerCase()
}

function compactText(value: string): string {
  return normalizeText(value).replace(/[\s\p{P}\p{S}_]+/gu, '')
}

function moderateTexts(texts: string[], terms: ModerationTerm[]): ModerationResult {
  let result: ModerationResult = { status: 'clean', reason: 'none' }
  let resultLevel = 0

  for (const text of texts) {
    if (!text?.trim()) continue

    const normalized = normalizeText(text)
    const compacted = compactText(text)

    for (const term of terms) {
      const normalizedTerm = normalizeText(term.term)
      const compactedTerm = compactText(term.term)
      const matched = term.match_mode === 'substring'
        ? normalized.includes(normalizedTerm)
        : compacted.includes(compactedTerm)

      if (!matched) continue

      const status: ModerationStatus = term.severity === 'block'
        ? 'blocked'
        : term.category === 'sexual_suggestive'
          ? 'suggestive'
          : 'needs_review'
      const level = status === 'blocked' ? 3 : status === 'needs_review' ? 2 : 1

      if (level > resultLevel) {
        result = { status, reason: term.category }
        resultLevel = level
      }
    }
  }

  return result
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data: role, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()

  if (roleError || !role) {
    throw new Error('관리자 권한이 없습니다.')
  }

  return supabase
}

async function loadModerationTerms(): Promise<ModerationTerm[] | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('moderation_terms')
    .select('term, severity, category, match_mode')
    .eq('enabled', true)

  if (error || !data) {
    console.error('Failed to load moderation terms:', error)
    return null
  }

  return data as ModerationTerm[]
}

function validateScope(scope: Record<string, unknown>): boolean {
  return ['target', 'period', 'method'].every(key => {
    const value = scope[key]
    return typeof value === 'string' && value.trim().length > 0
  })
}

export async function saveRankingE2E(
  id: string,
  rankingData: RankingData,
  criteria: CriterionInput[],
  sources: SourceInput[],
  entries: EntryInput[],
  facetIds: string[],
  expectedUpdatedAt: string
) {
  let supabase

  try {
    supabase = await requireAdmin()
  } catch (error) {
    return { error: error instanceof Error ? error.message : '권한 검증에 실패했습니다.' }
  }

  if (!id || !expectedUpdatedAt) {
    return { error: '저장 기준 버전 정보가 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.' }
  }

  if (!rankingData.category_id || !rankingData.title.trim() || !rankingData.slug.trim() || !rankingData.summary.trim()) {
    return { error: '카테고리, 제목, 슬러그, 요약 설명은 필수입니다.' }
  }

  if (!validateScope(rankingData.scope_json || {})) {
    return { error: '후보군 범위(Scope)의 대상, 기간, 선정 방법을 모두 입력해 주세요.' }
  }

  if (criteria.length < 1 || criteria.some(criterion =>
    !criterion.name.trim()
    || !Number.isInteger(Number(criterion.sort_order))
    || Number(criterion.sort_order) < 0
  )) {
    return { error: '평가 기준을 최소 1개 입력하고 이름과 정렬 순서를 확인해 주세요.' }
  }

  if (entries.length < 1) {
    return { error: '순위표 항목은 최소 1개 이상 필요합니다.' }
  }

  const positions = entries.map(entry => Number(entry.position))
  if (positions.some(position => !Number.isInteger(position) || position < 1)) {
    return { error: '모든 순위는 1 이상의 정수여야 합니다.' }
  }
  if (new Set(positions).size !== positions.length) {
    return { error: '순위표에 중복된 순위가 존재합니다.' }
  }

  const itemIds = entries.map(entry => entry.item_id)
  if (itemIds.some(itemId => !itemId) || new Set(itemIds).size !== itemIds.length) {
    return { error: '순위표 아이템이 누락되었거나 중복 등록되어 있습니다.' }
  }
  if (entries.some(entry => !entry.reason.trim())) {
    return { error: '각 순위 항목의 선정 이유를 입력해 주세요.' }
  }
  if (new Set(facetIds).size !== facetIds.length) {
    return { error: '중복된 페이셋이 선택되어 있습니다.' }
  }

  const terms = await loadModerationTerms()
  const rankingModeration: ModerationResult = terms
    ? moderateTexts([
        rankingData.title,
        rankingData.summary,
        rankingData.body || '',
        JSON.stringify(rankingData.scope_json || {}),
        rankingData.seo_title || '',
        rankingData.seo_description || '',
        ...criteria.flatMap(criterion => [criterion.name, criterion.description || '']),
        ...sources.flatMap(source => [source.label, source.note || ''])
      ], terms)
    : { status: 'needs_review', reason: 'system_error' }

  const moderatedEntries = entries.map(entry => {
    const moderation = terms
      ? moderateTexts([entry.reason, entry.internal_note || ''], terms)
      : { status: 'needs_review' as const, reason: 'system_error' as const }

    return {
      item_id: entry.item_id,
      position: Number(entry.position),
      reason: entry.reason.trim(),
      editor_score: entry.editor_score ?? null,
      score_json: entry.score_json || {},
      internal_note: entry.internal_note || null,
      sponsor_flag: entry.sponsor_flag,
      moderation_status: moderation.status,
      moderation_reason: moderation.reason
    }
  })

  const { data, error } = await supabase.rpc('save_ranking_e2e', {
    p_ranking_id: id,
    p_ranking_data: {
      category_id: rankingData.category_id,
      subcategory_id: rankingData.subcategory_id || null,
      title: rankingData.title.trim(),
      slug: rankingData.slug.trim().toLowerCase(),
      summary: rankingData.summary.trim(),
      body: rankingData.body || null,
      ranking_type: rankingData.ranking_type,
      scope_json: rankingData.scope_json,
      featured: rankingData.featured,
      seo_title: rankingData.seo_title || null,
      seo_description: rankingData.seo_description || null,
      cover_image_url: rankingData.cover_image_url || null,
      moderation_status: rankingModeration.status,
      moderation_reason: rankingModeration.reason
    },
    p_criteria: criteria.map(criterion => ({
      name: criterion.name.trim(),
      description: criterion.description || null,
      weight: criterion.weight ?? null,
      sort_order: Number(criterion.sort_order)
    })),
    p_sources: sources.map(source => ({
      label: source.label.trim(),
      url: source.url || null,
      source_type: source.source_type || null,
      note: source.note || null,
      is_public: source.is_public
    })),
    p_entries: moderatedEntries,
    p_facet_ids: facetIds,
    p_expected_updated_at: expectedUpdatedAt
  })

  if (error) {
    if (error.code === '40001') {
      return { error: '다른 세션에서 이 랭킹이 먼저 수정되었습니다. 페이지를 새로고침한 뒤 변경 사항을 다시 확인해 주세요.' }
    }
    if (error.code === '23505') {
      return { error: '이미 존재하는 슬러그이거나 중복된 순위·아이템·페이셋이 있습니다.' }
    }
    return { error: `랭킹 저장 실패: ${error.message}` }
  }

  revalidatePath('/', 'layout')
  revalidatePath(`/admin/rankings/${id}/edit`)
  revalidatePath(`/admin/rankings/${id}/preview`)

  const result = data as { was_published?: boolean; updated_at?: string } | null
  return {
    success: true,
    wasPublished: Boolean(result?.was_published),
    updatedAt: result?.updated_at || null
  }
}
