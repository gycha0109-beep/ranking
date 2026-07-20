'use server'

import * as legacy from './admin'
import { createClient } from '@/lib/supabase/server'
import { saveRankingE2E as saveRankingTransaction } from './save-ranking'
import {
  listModerationReviews as listReviews,
  reviewModerationTarget as reviewTarget,
} from './moderation-reviews'

export async function listAdminCategories(...args: Parameters<typeof legacy.listAdminCategories>) { return legacy.listAdminCategories(...args) }
export async function createCategory(...args: Parameters<typeof legacy.createCategory>) { return legacy.createCategory(...args) }
export async function updateCategory(...args: Parameters<typeof legacy.updateCategory>) { return legacy.updateCategory(...args) }
export async function listAdminSubcategories(...args: Parameters<typeof legacy.listAdminSubcategories>) { return legacy.listAdminSubcategories(...args) }
export async function createSubcategory(...args: Parameters<typeof legacy.createSubcategory>) { return legacy.createSubcategory(...args) }
export async function updateSubcategory(...args: Parameters<typeof legacy.updateSubcategory>) { return legacy.updateSubcategory(...args) }
export async function listFacetGroups(...args: Parameters<typeof legacy.listFacetGroups>) { return legacy.listFacetGroups(...args) }
export async function createFacetGroup(...args: Parameters<typeof legacy.createFacetGroup>) { return legacy.createFacetGroup(...args) }
export async function createFacet(...args: Parameters<typeof legacy.createFacet>) { return legacy.createFacet(...args) }
export async function updateFacet(...args: Parameters<typeof legacy.updateFacet>) { return legacy.updateFacet(...args) }
export async function listAdminItems(...args: Parameters<typeof legacy.listAdminItems>) { return legacy.listAdminItems(...args) }
export async function createItem(...args: Parameters<typeof legacy.createItem>) { return legacy.createItem(...args) }
export async function updateItem(...args: Parameters<typeof legacy.updateItem>) { return legacy.updateItem(...args) }
export async function listAdminRankings(...args: Parameters<typeof legacy.listAdminRankings>) { return legacy.listAdminRankings(...args) }
export async function createRankingDraft(...args: Parameters<typeof legacy.createRankingDraft>) { return legacy.createRankingDraft(...args) }
export async function publishRanking(...args: Parameters<typeof legacy.publishRanking>) { return legacy.publishRanking(...args) }
export async function unpublishRanking(...args: Parameters<typeof legacy.unpublishRanking>) { return legacy.unpublishRanking(...args) }
export async function createQuickRanking(...args: Parameters<typeof legacy.createQuickRanking>) { return legacy.createQuickRanking(...args) }
export async function reviewModerationTarget(...args: Parameters<typeof reviewTarget>) { return reviewTarget(...args) }
export async function listModerationReviews(...args: Parameters<typeof listReviews>) { return listReviews(...args) }

export async function saveRankingE2E(
  id: string,
  rankingData: Parameters<typeof saveRankingTransaction>[1],
  criteria: Parameters<typeof saveRankingTransaction>[2],
  sources: Parameters<typeof saveRankingTransaction>[3],
  entries: Parameters<typeof saveRankingTransaction>[4],
  facetIds: Parameters<typeof saveRankingTransaction>[5]
) {
  const supabase = await createClient()
  const { data: current, error } = await supabase
    .from('rankings')
    .select('updated_at')
    .eq('id', id)
    .maybeSingle()

  if (error || !current?.updated_at) {
    return { error: '저장 기준 버전을 확인할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.' }
  }

  return saveRankingTransaction(id, rankingData, criteria, sources, entries, facetIds, current.updated_at)
}
