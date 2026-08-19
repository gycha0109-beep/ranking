'use server'

import { runAdminRpc } from '@/lib/actions/admin-access'

export type Measure1Baseline = {
  period?: { from?: string; to?: string }
  eligible?: {
    content_views?: number
    ranking_views?: number
    item_views?: number
    distinct_daily_viewers?: number
  }
  qa_internal?: {
    content_views?: number
    searches?: number
    discovery_clicks?: number
  }
  search?: {
    searches?: number
    distinct_daily_searchers?: number
    zero_result_searches?: number
    zero_result_rate?: number
    clicked_searches?: number
    search_result_ctr?: number
  }
  discovery_by_source?: Record<string, number>
  engagement?: {
    likes?: number
    bookmarks?: number
    comments?: number
    reactions?: number
  }
  top_queries?: Array<{
    query?: string
    searches?: number
    zero_result_searches?: number
  }>
  legacy_view_authority?: {
    table?: string
    baseline_eligible?: boolean
    reason?: string
  }
}

export async function getMeasure1Baseline(from: string, to: string): Promise<{
  data: Measure1Baseline | null
  error?: string
}> {
  try {
    const { data, error } = await runAdminRpc('audit_view', 'admin_get_measure_1_baseline', {
      p_from: from,
      p_to: to,
    }, {
      routeKey: '/admin/measure',
      resourceKey: 'measure_1_baseline',
      actionKey: 'admin_get_measure_1_baseline',
    })
    if (error) return { data: null, error: error.message }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { data: null, error: '측정 baseline 응답이 올바르지 않습니다.' }
    return { data: data as Measure1Baseline }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : '측정 baseline을 불러오지 못했습니다.' }
  }
}
