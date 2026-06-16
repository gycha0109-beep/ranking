import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listAdminCategories, listAdminSubcategories, listAdminItems, listFacetGroups } from '@/lib/actions/admin'
import RankingEditorForm from './RankingEditorForm'
import { ArrowLeft, FileSpreadsheet } from 'lucide-react'

interface Props {
  params: Promise<{
    id: string
  }>
}

export const dynamic = 'force-dynamic'

export default async function AdminRankingEditPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // 1. 수정할 랭킹 정보 조회
  const { data: ranking, error: rankingError } = await supabase
    .from('rankings')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (rankingError || !ranking) {
    notFound()
  }

  // 2. 랭킹에 종속된 부속 데이터 조회 (criteria, sources, entries, facets)
  const [
    { data: criteria },
    { data: sources },
    { data: entries },
    { data: rankingFacetsData },
    categories,
    subcategories,
    items,
    allFacetGroups
  ] = await Promise.all([
    supabase.from('ranking_criteria').select('*').eq('ranking_id', id).order('sort_order', { ascending: true }),
    supabase.from('ranking_sources').select('*').eq('ranking_id', id),
    supabase.from('ranking_entries').select('*').eq('ranking_id', id).order('position', { ascending: true }),
    supabase.from('ranking_facets').select('facet_id').eq('ranking_id', id),
    listAdminCategories(),
    listAdminSubcategories(),
    listAdminItems(),
    listFacetGroups()
  ])

  // 현재 매핑되어 있는 페이셋 ID 배열화
  const activeFacetIds = (rankingFacetsData || []).map((rf: any) => rf.facet_id)

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a0a0f] to-[#07070a] text-slate-100">
      <div className="max-w-7xl mx-auto">
        
        {/* 뒤로가기 링크 */}
        <Link 
          href="/admin/rankings" 
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white mb-6 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 px-3 py-1.5 rounded-lg transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          랭킹 목록으로 돌아가기
        </Link>

        {/* 상단 타이틀 */}
        <div className="mb-8 pb-4 border-b border-white/[0.06]">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-purple-400" />
            랭킹 E2E 상세 에디터
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            랭킹의 기본 소개 정보, 선정 평가 기준, 기사 출처 및 상세 순위표(Entries)를 일괄적으로 안전하게 수정합니다.
          </p>
        </div>

        {/* 대형 인터랙티브 폼 마운트 */}
        <RankingEditorForm 
          ranking={ranking}
          initialCriteria={criteria || []}
          initialSources={sources || []}
          initialEntries={entries || []}
          initialActiveFacetIds={activeFacetIds}
          categories={categories}
          subcategories={subcategories}
          items={items}
          facetGroups={allFacetGroups}
        />

      </div>
    </div>
  )
}
