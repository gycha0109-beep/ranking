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
  parseRankingSemanticProjectionForm,
  type RankingSemanticProjectionFormInput,
} from '@/lib/ranking-semantic-input'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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

async function loadWorkspace(rankingId: string): Promise<RankingSemanticWorkspace> {
  const admin = createAdminClient()

  const [{ data: ranking, error: rankingError }, { data: projection, error: projectionError }] = await Promise.all([
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
  ])

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

  const { error: upsertError } = await admin
    .from('ranking_semantic_projections')
    .upsert({
      ranking_id: rankingId,
      subject_key: parsed.value.subject_key,
      intent_key: parsed.value.intent_key,
      coordinates: parsed.value.coordinates,
      method_key: parsed.value.method_key,
      version_coordinates: parsed.value.version_coordinates,
      classification_state: 'reviewed',
      confidence: 1,
      projection_version: 'ia-2b-admin-manual-v1',
      claim_signature: '',
      view_signature: '',
      version_signature: '',
    }, { onConflict: 'ranking_id' })

  if (upsertError) return { error: `Semantic projection 저장 실패: ${upsertError.message}` }

  revalidatePath(`/admin/rankings/${rankingId}/edit`)
  if (ranking.slug) revalidatePath(`/rankings/${ranking.slug}`)

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
