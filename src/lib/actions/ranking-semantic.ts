'use server'

import { revalidatePath } from 'next/cache'
import {
  classifyRankingIdentity,
  compareRankingIdentityRelations,
  explainRankingIdentity,
  SEMANTIC_SUBJECT_CANDIDATE_LIMIT,
  type RankingIdentityRelation,
  type RankingSemanticProjection,
} from '@/lib/ranking-identity'
import {
  isRankingSemanticKey,
  normalizeRankingSemanticKey,
  parseRankingSemanticProjectionForm,
  type RankingSemanticProjectionFormInput,
} from '@/lib/ranking-semantic-input'
import type {
  RankingSubjectAlias,
  RankingSubjectOption,
} from '@/lib/ranking-subject-suggestions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const SUBJECT_CATALOG_PROJECTION_LIMIT = 1000
const SUBJECT_ALIAS_LIMIT = 500

export type RankingSemanticAdvisory = {
  ranking_id: string
  title: string
  slug: string
  status: string
  relation: RankingIdentityRelation['kind']
  reason: string
}

export type RankingSemanticWorkspace = {
  ranking: {
    id: string
    title: string
    slug: string
    status: string
  }
  projection: RankingSemanticProjection | null
  advisories: RankingSemanticAdvisory[]
  subject_options: RankingSubjectOption[]
  subject_aliases: RankingSubjectAlias[]
}

async function ensureAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()

  if (!roleData) throw new Error('관리자 권한이 없습니다.')
  return user
}

function relationStatusRank(status: string) {
  if (status === 'published') return 0
  if (status === 'draft') return 1
  return 2
}

async function loadSubjectCatalog(admin: ReturnType<typeof createAdminClient>) {
  const [subjectResult, aliasResult] = await Promise.all([
    admin
      .from('ranking_semantic_projections')
      .select('subject_key')
      .order('subject_key', { ascending: true })
      .limit(SUBJECT_CATALOG_PROJECTION_LIMIT),
    admin
      .from('ranking_semantic_subject_aliases')
      .select('alias_key, canonical_subject_key, created_at')
      .order('alias_key', { ascending: true })
      .limit(SUBJECT_ALIAS_LIMIT),
  ])

  if (subjectResult.error) {
    throw new Error(`Canonical Subject 조회 실패: ${subjectResult.error.message}`)
  }
  if (aliasResult.error) {
    throw new Error(`Subject alias 조회 실패: ${aliasResult.error.message}`)
  }

  const usageCounts = new Map<string, number>()
  for (const row of subjectResult.data || []) {
    if (!row.subject_key) continue
    usageCounts.set(row.subject_key, (usageCounts.get(row.subject_key) || 0) + 1)
  }

  const aliases = (aliasResult.data || []) as RankingSubjectAlias[]
  const aliasesByCanonical = new Map<string, string[]>()
  for (const alias of aliases) {
    if (!alias.canonical_subject_key || !alias.alias_key) continue
    const current = aliasesByCanonical.get(alias.canonical_subject_key) || []
    current.push(alias.alias_key)
    aliasesByCanonical.set(alias.canonical_subject_key, current)
    if (!usageCounts.has(alias.canonical_subject_key)) {
      usageCounts.set(alias.canonical_subject_key, 0)
    }
  }

  const options: RankingSubjectOption[] = [...usageCounts.entries()]
    .map(([subject_key, usage_count]) => ({
      subject_key,
      usage_count,
      aliases: (aliasesByCanonical.get(subject_key) || []).sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => {
      if (left.usage_count !== right.usage_count) return right.usage_count - left.usage_count
      return left.subject_key.localeCompare(right.subject_key)
    })

  return { options, aliases }
}

async function resolveCanonicalSubjectKey(
  admin: ReturnType<typeof createAdminClient>,
  subjectKey: string
) {
  const { data, error } = await admin
    .from('ranking_semantic_subject_aliases')
    .select('canonical_subject_key')
    .eq('alias_key', subjectKey)
    .maybeSingle()

  if (error) throw new Error(`Subject alias 해석 실패: ${error.message}`)
  return data?.canonical_subject_key || subjectKey
}

async function loadWorkspace(rankingId: string): Promise<RankingSemanticWorkspace> {
  const admin = createAdminClient()

  const [rankingResult, projectionResult, subjectCatalog] = await Promise.all([
    admin
      .from('rankings')
      .select('id, title, slug, status')
      .eq('id', rankingId)
      .maybeSingle(),
    admin
      .from('ranking_semantic_projections')
      .select('*')
      .eq('ranking_id', rankingId)
      .maybeSingle(),
    loadSubjectCatalog(admin),
  ])

  const { data: ranking, error: rankingError } = rankingResult
  const { data: projection, error: projectionError } = projectionResult
  if (rankingError || !ranking) throw new Error('랭킹 문서를 찾을 수 없습니다.')
  if (projectionError) throw new Error(`Semantic projection 조회 실패: ${projectionError.message}`)

  const currentProjection = (projection || null) as RankingSemanticProjection | null
  const advisories: Array<RankingSemanticAdvisory & { priority: number }> = []

  if (currentProjection?.subject_key) {
    const { data: candidateRows, error: candidateError } = await admin
      .from('ranking_semantic_projections')
      .select('*, rankings!inner(id, title, slug, status, updated_at)')
      .eq('subject_key', currentProjection.subject_key)
      .neq('ranking_id', rankingId)
      .order('ranking_id', { ascending: true })
      .limit(SEMANTIC_SUBJECT_CANDIDATE_LIMIT)

    if (candidateError) {
      throw new Error(`Semantic advisory 후보 조회 실패: ${candidateError.message}`)
    }

    for (const row of candidateRows || []) {
      const candidateProjection = row as RankingSemanticProjection
      const relation = classifyRankingIdentity(currentProjection, candidateProjection)
      if (!relation) continue

      const linkedRanking = Array.isArray((row as any).rankings)
        ? (row as any).rankings[0]
        : (row as any).rankings
      if (!linkedRanking?.id) continue

      advisories.push({
        ranking_id: linkedRanking.id,
        title: linkedRanking.title || '제목 없음',
        slug: linkedRanking.slug || '',
        status: linkedRanking.status || 'unknown',
        relation: relation.kind,
        reason: explainRankingIdentity(relation),
        priority: relation.priority,
      })
    }
  }

  advisories.sort((left, right) => {
    const relationOrder = compareRankingIdentityRelations(
      { kind: left.relation, priority: left.priority },
      { kind: right.relation, priority: right.priority }
    )
    if (relationOrder !== 0) return relationOrder

    const statusOrder = relationStatusRank(left.status) - relationStatusRank(right.status)
    if (statusOrder !== 0) return statusOrder
    return left.ranking_id.localeCompare(right.ranking_id)
  })

  return {
    ranking: {
      id: ranking.id,
      title: ranking.title,
      slug: ranking.slug,
      status: ranking.status,
    },
    projection: currentProjection,
    advisories: advisories.slice(0, 12).map(advisory => ({
      ranking_id: advisory.ranking_id,
      title: advisory.title,
      slug: advisory.slug,
      status: advisory.status,
      relation: advisory.relation,
      reason: advisory.reason,
    })),
    subject_options: subjectCatalog.options,
    subject_aliases: subjectCatalog.aliases,
  }
}

export async function getRankingSemanticWorkspace(rankingId: string) {
  await ensureAdmin()
  return loadWorkspace(rankingId)
}

export async function saveRankingSemanticProjection(
  rankingId: string,
  formInput: RankingSemanticProjectionFormInput
) {
  await ensureAdmin()
  const parsed = parseRankingSemanticProjectionForm(formInput)
  if (!parsed.ok) return { error: parsed.error }

  const admin = createAdminClient()
  const { data: ranking, error: rankingError } = await admin
    .from('rankings')
    .select('id, slug')
    .eq('id', rankingId)
    .maybeSingle()

  if (rankingError || !ranking) return { error: '랭킹 문서를 찾을 수 없습니다.' }

  let canonicalSubjectKey: string
  try {
    canonicalSubjectKey = await resolveCanonicalSubjectKey(admin, parsed.value.subject_key)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Subject alias 해석에 실패했습니다.' }
  }

  const { error: upsertError } = await admin
    .from('ranking_semantic_projections')
    .upsert({
      ranking_id: rankingId,
      subject_key: canonicalSubjectKey,
      intent_key: parsed.value.intent_key,
      coordinates: parsed.value.coordinates,
      method_key: parsed.value.method_key,
      version_coordinates: parsed.value.version_coordinates,
      classification_state: 'reviewed',
      confidence: 1,
      projection_version: 'ia-2c-admin-manual-v1',
      claim_signature: '',
      view_signature: '',
      version_signature: '',
    }, { onConflict: 'ranking_id' })

  if (upsertError) return { error: `Semantic projection 저장 실패: ${upsertError.message}` }

  revalidatePath(`/admin/rankings/${rankingId}/edit`)
  if (ranking.slug) revalidatePath(`/rankings/${ranking.slug}`)

  return {
    success: true,
    workspace: await loadWorkspace(rankingId),
    subject_resolution: {
      input_subject_key: parsed.value.subject_key,
      canonical_subject_key: canonicalSubjectKey,
      resolved_via_alias: canonicalSubjectKey !== parsed.value.subject_key,
    },
  }
}

export async function createRankingSubjectAlias(
  rankingId: string,
  rawAliasKey: string,
  rawCanonicalSubjectKey: string
) {
  const user = await ensureAdmin()
  const aliasKey = normalizeRankingSemanticKey(rawAliasKey)
  const canonicalSubjectKey = normalizeRankingSemanticKey(rawCanonicalSubjectKey)

  if (!isRankingSemanticKey(aliasKey)) {
    return { error: 'Alias key 형식이 올바르지 않습니다.' }
  }
  if (!isRankingSemanticKey(canonicalSubjectKey)) {
    return { error: 'Canonical Subject key 형식이 올바르지 않습니다.' }
  }
  if (aliasKey === canonicalSubjectKey) {
    return { error: 'Alias와 Canonical Subject는 서로 달라야 합니다.' }
  }

  const admin = createAdminClient()
  const [
    existingAliasResult,
    aliasProjectionResult,
    canonicalProjectionResult,
    canonicalTargetResult,
    canonicalAliasResult,
  ] = await Promise.all([
    admin
      .from('ranking_semantic_subject_aliases')
      .select('alias_key, canonical_subject_key')
      .eq('alias_key', aliasKey)
      .maybeSingle(),
    admin
      .from('ranking_semantic_projections')
      .select('ranking_id')
      .eq('subject_key', aliasKey)
      .limit(1)
      .maybeSingle(),
    admin
      .from('ranking_semantic_projections')
      .select('ranking_id')
      .eq('subject_key', canonicalSubjectKey)
      .limit(1)
      .maybeSingle(),
    admin
      .from('ranking_semantic_subject_aliases')
      .select('alias_key')
      .eq('canonical_subject_key', canonicalSubjectKey)
      .limit(1)
      .maybeSingle(),
    admin
      .from('ranking_semantic_subject_aliases')
      .select('canonical_subject_key')
      .eq('alias_key', canonicalSubjectKey)
      .maybeSingle(),
  ])

  const lookupError = [
    existingAliasResult.error,
    aliasProjectionResult.error,
    canonicalProjectionResult.error,
    canonicalTargetResult.error,
    canonicalAliasResult.error,
  ].find(Boolean)
  if (lookupError) return { error: `Subject alias 검증 실패: ${lookupError.message}` }

  if (existingAliasResult.data) {
    if (existingAliasResult.data.canonical_subject_key === canonicalSubjectKey) {
      return { success: true, workspace: await loadWorkspace(rankingId) }
    }
    return { error: `이미 ${existingAliasResult.data.canonical_subject_key}에 연결된 Alias입니다.` }
  }

  if (aliasProjectionResult.data) {
    return { error: '이미 실제 projection의 Canonical Subject로 사용 중인 key는 Alias로 바꿀 수 없습니다.' }
  }
  if (canonicalAliasResult.data) {
    return { error: 'Alias를 다시 Canonical Subject로 연결하는 alias chain은 허용하지 않습니다.' }
  }
  if (!canonicalProjectionResult.data && !canonicalTargetResult.data) {
    return { error: 'Canonical Subject는 먼저 실제 projection에서 사용된 key여야 합니다.' }
  }

  const { error: insertError } = await admin
    .from('ranking_semantic_subject_aliases')
    .insert({
      alias_key: aliasKey,
      canonical_subject_key: canonicalSubjectKey,
      created_by: user.id,
    })

  if (insertError) return { error: `Subject alias 등록 실패: ${insertError.message}` }

  revalidatePath(`/admin/rankings/${rankingId}/edit`)
  return { success: true, workspace: await loadWorkspace(rankingId) }
}

export async function deleteRankingSubjectAlias(rankingId: string, rawAliasKey: string) {
  await ensureAdmin()
  const aliasKey = normalizeRankingSemanticKey(rawAliasKey)
  if (!isRankingSemanticKey(aliasKey)) return { error: 'Alias key 형식이 올바르지 않습니다.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('ranking_semantic_subject_aliases')
    .delete()
    .eq('alias_key', aliasKey)

  if (error) return { error: `Subject alias 삭제 실패: ${error.message}` }

  revalidatePath(`/admin/rankings/${rankingId}/edit`)
  return { success: true, workspace: await loadWorkspace(rankingId) }
}

export async function clearRankingSemanticProjection(rankingId: string) {
  await ensureAdmin()
  const admin = createAdminClient()

  const { data: ranking, error: rankingError } = await admin
    .from('rankings')
    .select('id, slug')
    .eq('id', rankingId)
    .maybeSingle()

  if (rankingError || !ranking) return { error: '랭킹 문서를 찾을 수 없습니다.' }

  const { error } = await admin
    .from('ranking_semantic_projections')
    .delete()
    .eq('ranking_id', rankingId)

  if (error) return { error: `Semantic projection 해제 실패: ${error.message}` }

  revalidatePath(`/admin/rankings/${rankingId}/edit`)
  if (ranking.slug) revalidatePath(`/rankings/${ranking.slug}`)

  return { success: true, workspace: await loadWorkspace(rankingId) }
}
