'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveRankingE2E } from '@/lib/actions/admin'
import { 
  Save, 
  PlusCircle, 
  Trash2, 
  HelpCircle, 
  Layers, 
  FileText, 
  Award, 
  Link2, 
  Check, 
  Eye, 
  AlertTriangle,
  Search
} from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
}

interface Subcategory {
  id: string
  category_id: string
  name: string
  slug: string
}

interface Item {
  id: string
  title: string
  brand_or_creator?: string | null
  item_type: string
}

interface Facet {
  id: string
  facet_group_id: string
  name: string
  slug: string
}

interface FacetGroup {
  id: string
  code: string
  name: string
  applies_to: 'ranking' | 'item' | 'both'
  facets?: Facet[]
}

interface Props {
  ranking: any
  initialCriteria: any[]
  initialSources: any[]
  initialEntries: any[]
  initialActiveFacetIds: string[]
  categories: any[]
  subcategories: any[]
  items: any[]
  facetGroups: any[]
}

export default function RankingEditorForm({
  ranking,
  initialCriteria,
  initialSources,
  initialEntries,
  initialActiveFacetIds,
  categories,
  subcategories,
  items,
  facetGroups
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // 1. 피드백 상태
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // 2. 기본 정보 상태
  const [categoryId, setCategoryId] = useState(ranking.category_id || '')
  const [subcategoryId, setSubcategoryId] = useState(ranking.subcategory_id || '')
  const [title, setTitle] = useState(ranking.title || '')
  const [slug, setSlug] = useState(ranking.slug || '')
  const [summary, setSummary] = useState(ranking.summary || '')
  const [body, setBody] = useState(ranking.body || '')
  const [rankingType, setRankingType] = useState(ranking.ranking_type || 'editor_pick')
  const [coverImageUrl, setCoverImageUrl] = useState(ranking.cover_image_url || '')
  const [featured, setFeatured] = useState(ranking.featured || false)

  // 3. Scope JSON (target, period, method 로 인풋 분리)
  const scopeObj = ranking.scope_json || {}
  const [scopeTarget, setScopeTarget] = useState(scopeObj.target || '')
  const [scopePeriod, setScopePeriod] = useState(scopeObj.period || '')
  const [scopeMethod, setScopeMethod] = useState(scopeObj.method || '')

  // 4. 서브카테고리 동적 필터링
  const [filteredSubcategories, setFilteredSubcategories] = useState<Subcategory[]>([])
  
  useEffect(() => {
    if (categoryId) {
      const filtered = (subcategories as Subcategory[]).filter(s => s.category_id === categoryId)
      setFilteredSubcategories(filtered)
    } else {
      setFilteredSubcategories([])
    }
  }, [categoryId, subcategories])

  // 5. 선정 평가 기준 (Criteria) 상태
  const [criteria, setCriteria] = useState<any[]>(
    initialCriteria.map(c => ({
      id: c.id,
      name: c.name || '',
      description: c.description || '',
      weight: c.weight || '',
      sort_order: c.sort_order || 10
    }))
  )

  // 6. 출처/근거 (Sources) 상태
  const [sources, setSources] = useState<any[]>(
    initialSources.map(s => ({
      id: s.id,
      label: s.label || '',
      url: s.url || '',
      source_type: s.source_type || 'article',
      note: s.note || '',
      is_public: s.is_public !== false
    }))
  )

  // 7. 순위표 항목 (Entries) 상태
  const [entries, setEntries] = useState<any[]>(
    initialEntries.map(e => ({
      id: e.id,
      item_id: e.item_id || '',
      position: e.position || '',
      reason: e.reason || '',
      editor_score: e.editor_score || '',
      sponsor_flag: e.sponsor_flag || false,
      // UI용 임시 검색 키워드
      itemSearchKeyword: (items.find(item => item.id === e.item_id)?.title) || ''
    }))
  )

  // 8. 랭킹용 페이셋 다중 매핑 상태
  const [activeFacetIds, setActiveFacetIds] = useState<string[]>(initialActiveFacetIds)

  // 랭킹 대상 페이셋 그룹만 필터링 (applies_to 가 'ranking' 또는 'both'인 것)
  const rankingFacetGroups = (facetGroups as FacetGroup[]).filter(
    g => g.applies_to === 'ranking' || g.applies_to === 'both'
  )

  // ==========================================
  // [C] 이벤트 핸들러 모음
  // ==========================================

  // Criteria 동적 제어
  const addCriteriaRow = () => {
    setCriteria(prev => [
      ...prev,
      { name: '', description: '', weight: '', sort_order: (prev.length + 1) * 10 }
    ])
  }

  const removeCriteriaRow = (index: number) => {
    setCriteria(prev => prev.filter((_, i) => i !== index))
  }

  const updateCriteriaRow = (index: number, field: string, value: any) => {
    setCriteria(prev => {
      const copy = [...prev]
      copy[index][field] = value
      return copy
    })
  }

  // Sources 동적 제어
  const addSourceRow = () => {
    setSources(prev => [
      ...prev,
      { label: '', url: '', source_type: 'article', note: '', is_public: true }
    ])
  }

  const removeSourceRow = (index: number) => {
    setSources(prev => prev.filter((_, i) => i !== index))
  }

  const updateSourceRow = (index: number, field: string, value: any) => {
    setSources(prev => {
      const copy = [...prev]
      copy[index][field] = value
      return copy
    })
  }

  // Entries 동적 제어
  const addEntryRow = () => {
    setEntries(prev => [
      ...prev,
      { item_id: '', position: prev.length + 1, reason: '', editor_score: '', sponsor_flag: false, itemSearchKeyword: '' }
    ])
  }

  const removeEntryRow = (index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  const updateEntryRow = (index: number, field: string, value: any) => {
    setEntries(prev => {
      const copy = [...prev]
      copy[index][field] = value
      return copy
    })
  }

  // Facet 체크박스 제어
  const handleFacetCheckbox = (facetId: string, isChecked: boolean) => {
    if (isChecked) {
      setActiveFacetIds(prev => [...prev, facetId])
    } else {
      setActiveFacetIds(prev => prev.filter(id => id !== facetId))
    }
  }

  // E2E 일괄 저장 실행
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    // 1. 순위표 항목 필수 확인
    if (entries.length === 0) {
      setErrorMessage('순위표 항목(Entries)은 최소 1개 이상 추가해야 저장 가능합니다.')
      return
    }

    // 2. 평가 기준 필수 확인
    if (criteria.length === 0) {
      setErrorMessage('평가 기준(Criteria)은 최소 1개 이상 추가해야 저장 가능합니다.')
      return
    }

    // 3. 아이템 매핑 체크
    if (entries.some(ent => !ent.item_id)) {
      setErrorMessage('순위표 항목 중 아이템이 선택되지 않은 행이 있습니다.')
      return
    }

    // 4. 데이터 가공
    const rankingData = {
      category_id: categoryId,
      subcategory_id: subcategoryId || undefined,
      title,
      slug: slug.trim().toLowerCase(),
      summary,
      body: body || undefined,
      ranking_type: rankingType,
      // 가공된 Scope JSON 빌드
      scope_json: {
        target: scopeTarget,
        period: scopePeriod,
        method: scopeMethod
      },
      featured,
      cover_image_url: coverImageUrl || undefined
    }

    const processedCriteria = criteria.map(c => ({
      name: c.name,
      description: c.description || undefined,
      weight: c.weight ? Number(c.weight) : undefined,
      sort_order: Number(c.sort_order)
    }))

    const processedSources = sources.map(s => ({
      label: s.label,
      url: s.url || undefined,
      source_type: s.source_type,
      note: s.note || undefined,
      is_public: s.is_public
    }))

    const processedEntries = entries.map(e => ({
      item_id: e.item_id,
      position: Number(e.position),
      reason: e.reason,
      editor_score: e.editor_score ? Number(e.editor_score) : undefined,
      sponsor_flag: e.sponsor_flag
    }))

    startTransition(async () => {
      const result = await saveRankingE2E(
        ranking.id,
        rankingData,
        processedCriteria,
        processedSources,
        processedEntries,
        activeFacetIds
      )

      if (result.error) {
        setErrorMessage(result.error)
      } else {
        setSuccessMessage('랭킹 문서 및 모든 연동 항목이 안전하게 일괄 업데이트되었습니다.')
        router.refresh()
        
        // 페이지 상단으로 스크롤 이동
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
  }

  return (
    <form onSubmit={handleFormSubmit} className="space-y-8">
      
      {/* 알림 배지 */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button 
            type="button"
            onClick={() => router.push(`/admin/rankings/${ranking.id}/preview`)}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] transition-all flex items-center gap-1 shrink-0"
          >
            <Eye className="w-3 h-3" />
            프리뷰 및 발행하기
          </button>
        </div>
      )}

      {/* 1. 기본 정보 블록 */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 space-y-6">
        <h2 className="text-sm font-bold text-slate-200 border-b border-white/5 pb-3 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-indigo-400" />
          1단계. 랭킹 기본 기획안 수정
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 font-bold mb-1.5">대분류 카테고리 *</label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
            >
              {categories.map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-bold mb-1.5">소분류 서브카테고리</label>
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
            >
              <option value="">서브카테고리 없음 (대분류 단독)</option>
              {filteredSubcategories.map((sub: any) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-400 font-bold mb-1.5">랭킹 주제 제목 *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2026년 국내 최고의 맛있는 닭가슴살 추천 랭킹"
              className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-bold mb-1.5">슬러그 *</label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="예: best-chicken-breast"
              className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 font-bold mb-1.5">한 줄 요약 설명 *</label>
          <input
            type="text"
            required
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="랭킹 목록에 노출될 대표 요약 설명"
            className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 font-bold mb-1.5">랭킹 본문 상세 글 (Body / 선택)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="랭킹에 대한 전반적인 총평, 기획 방향, 세부 리포트 설명 작성"
            rows={5}
            className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-400 font-bold mb-1.5">랭킹 판정 유형 *</label>
            <select
              required
              value={rankingType}
              onChange={(e) => setRankingType(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
            >
              <option value="editor_pick">에디터 추천 (editor_pick)</option>
              <option value="popularity">인기순 (popularity)</option>
              <option value="quality">성분/품질비교 (quality)</option>
              <option value="purpose">특수목적용 (purpose)</option>
              <option value="user_vote">유저투표 (user_vote)</option>
              <option value="sponsored">스폰서십 (sponsored)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-bold mb-1.5">대표 커버 이미지 주소 (URL)</label>
            <input
              type="url"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/... 등의 이미지 경로"
              className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-bold mb-1.5">Featured 여부</label>
            <div className="flex items-center h-[42px] pl-1">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
                <span className="ml-2 text-xs text-slate-300 font-semibold">{featured ? '홈 화면 대표 노출' : '일반 노출'}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Scope 정보 분리 인풋 */}
        <div className="pt-4 border-t border-white/5">
          <label className="block text-xs text-slate-300 font-bold mb-3 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            후보군 조사 범위 (Scope) 지정
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/40 p-4 rounded-2xl border border-white/5">
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">조사 대상 (target)</label>
              <input
                type="text"
                value={scopeTarget}
                onChange={(e) => setScopeTarget(e.target.value)}
                placeholder="예: 국내 온/오프라인 유통 닭가슴살 100종"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-white/10 rounded-lg focus:border-indigo-500 focus:outline-none text-slate-300"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">조사 기간 (period)</label>
              <input
                type="text"
                value={scopePeriod}
                onChange={(e) => setScopePeriod(e.target.value)}
                placeholder="예: 2026년 1월 ~ 5월"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-white/10 rounded-lg focus:border-indigo-500 focus:outline-none text-slate-300"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">평가 방법 (method)</label>
              <input
                type="text"
                value={scopeMethod}
                onChange={(e) => setScopeMethod(e.target.value)}
                placeholder="예: 성분 분석 검정 및 식감 소비자 패널 50명 블라인드 테스트"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-white/10 rounded-lg focus:border-indigo-500 focus:outline-none text-slate-300"
              />
            </div>
          </div>
        </div>

      </div>

      {/* 2. 랭킹용 페이셋 필터 매핑 블록 */}
      {rankingFacetGroups.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 border-b border-white/5 pb-3 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-400" />
            2단계. 랭킹 전용 페이셋 필터 연동 (공개 필터용)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {rankingFacetGroups.map((group) => (
              <div key={group.id} className="p-3.5 rounded-xl border border-white/5 bg-slate-950/20 space-y-2">
                <span className="text-[10px] font-black text-emerald-400 font-mono uppercase bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 inline-block">
                  {group.name}
                </span>
                <div className="space-y-1.5">
                  {group.facets?.map((fac) => (
                    <label key={fac.id} className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={activeFacetIds.includes(fac.id)}
                        onChange={(e) => handleFacetCheckbox(fac.id, e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-white/10 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      <span>{fac.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">/{fac.slug}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. 평가 선정 기준 (Criteria) 동적 행 추가 블록 */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-purple-400" />
            3단계. 랭킹 선정 평가 기준 (Criteria) 설정 *
          </h2>
          <button
            type="button"
            onClick={addCriteriaRow}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-purple-600/10 hover:bg-purple-600/25 border border-purple-500/20 text-purple-300 transition-all flex items-center gap-1"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            평가 항목 추가
          </button>
        </div>

        {criteria.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 italic">
            등록된 선정 기준이 없습니다. 우측 상단의 '평가 항목 추가'를 눌러 작성하십시오.
          </div>
        ) : (
          <div className="space-y-3">
            {criteria.map((c, idx) => (
              <div 
                key={idx} 
                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-900/30 p-3 rounded-xl border border-white/5 relative group"
              >
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-grow w-full">
                  <div className="sm:col-span-1">
                    <label className="block text-[9px] text-slate-500 font-bold mb-1">기준명 *</label>
                    <input
                      type="text"
                      required
                      value={c.name}
                      onChange={(e) => updateCriteriaRow(idx, 'name', e.target.value)}
                      placeholder="예: 단백질 함량, 가성비"
                      className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-white/10 rounded-lg focus:border-purple-500 focus:outline-none text-slate-200"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[9px] text-slate-500 font-bold mb-1">상세 기준 설명</label>
                    <input
                      type="text"
                      value={c.description}
                      onChange={(e) => updateCriteriaRow(idx, 'description', e.target.value)}
                      placeholder="예: 100g 당 단백질 비중 검토"
                      className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-white/10 rounded-lg focus:border-purple-500 focus:outline-none text-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:col-span-1">
                    <div>
                      <label className="block text-[9px] text-slate-500 font-bold mb-1">가중치 (%)</label>
                      <input
                        type="number"
                        value={c.weight}
                        onChange={(e) => updateCriteriaRow(idx, 'weight', e.target.value)}
                        placeholder="예: 40"
                        className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-white/10 rounded-lg focus:border-purple-500 focus:outline-none text-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-500 font-bold mb-1">정렬 순서</label>
                      <input
                        type="number"
                        required
                        value={c.sort_order}
                        onChange={(e) => updateCriteriaRow(idx, 'sort_order', Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-white/10 rounded-lg focus:border-purple-500 focus:outline-none text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeCriteriaRow(idx)}
                  className="sm:mt-4 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/10 transition-all shrink-0 self-end sm:self-center"
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. 출처 정보 (Sources) 동적 행 추가 블록 */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-amber-400" />
            4단계. 랭킹 작성 출처 및 통계 자료 근거 (Sources)
          </h2>
          <button
            type="button"
            onClick={addSourceRow}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-600/10 hover:bg-amber-600/25 border border-amber-500/20 text-amber-300 transition-all flex items-center gap-1"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            출처 링크 추가
          </button>
        </div>

        {sources.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 italic">
            등록된 근거 자료 출처 정보가 없습니다. 필요 시 우측 상단의 출처 추가를 활용하십시오.
          </div>
        ) : (
          <div className="space-y-3">
            {sources.map((s, idx) => (
              <div 
                key={idx} 
                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-900/30 p-3 rounded-xl border border-white/5 relative group"
              >
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-grow w-full">
                  <div className="sm:col-span-1">
                    <label className="block text-[9px] text-slate-500 font-bold mb-1">출처 라벨 *</label>
                    <input
                      type="text"
                      required
                      value={s.label}
                      onChange={(e) => updateSourceRow(idx, 'label', e.target.value)}
                      placeholder="예: 식약처 성분검사표, 뉴스기사"
                      className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-white/10 rounded-lg focus:border-amber-500 focus:outline-none text-slate-200"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[9px] text-slate-500 font-bold mb-1">출처 URL</label>
                    <input
                      type="url"
                      value={s.url}
                      onChange={(e) => updateSourceRow(idx, 'url', e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-white/10 rounded-lg focus:border-amber-500 focus:outline-none text-slate-200 font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:col-span-1">
                    <div>
                      <label className="block text-[9px] text-slate-500 font-bold mb-1">종류</label>
                      <select
                        value={s.source_type}
                        onChange={(e) => updateSourceRow(idx, 'source_type', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-white/10 rounded-lg focus:border-amber-500 focus:outline-none text-slate-200"
                      >
                        <option value="article">기사/문서 (article)</option>
                        <option value="report">학술/리포트 (report)</option>
                        <option value="government">정부/공공기관 (government)</option>
                        <option value="community">소비자여론 (community)</option>
                      </select>
                    </div>
                    <div className="flex flex-col justify-end pb-1.5 pl-2">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-400 font-bold">
                        <input
                          type="checkbox"
                          checked={s.is_public}
                          onChange={(e) => updateSourceRow(idx, 'is_public', e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-white/10 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
                        />
                        공개 노출
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeSourceRow(idx)}
                  className="sm:mt-4 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/10 transition-all shrink-0 self-end sm:self-center"
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. 랭킹 순위표 엔트리 (Entries) 대형 동적 편집 블록 */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400" />
            5단계. 랭킹 순위표 항목 (Ranking Entries) 구성 *
          </h2>
          <button
            type="button"
            onClick={addEntryRow}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-600/10 hover:bg-amber-600/25 border border-amber-500/20 text-amber-300 transition-all flex items-center gap-1"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            순위 및 아이템 추가
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 italic">
            순위표 구성 항목이 없습니다. 우측 상단의 '순위 및 아이템 추가'를 통해 순서대로 아이템을 맵핑하세요.
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((ent, idx) => {
              // 1. 키워드 검색 매칭 아이템 필터
              const filteredItems = items.filter((item: any) => {
                if (!ent.itemSearchKeyword) return false
                const word = ent.itemSearchKeyword.toLowerCase()
                return (
                  item.title.toLowerCase().includes(word) ||
                  (item.brand_or_creator && item.brand_or_creator.toLowerCase().includes(word))
                );
              });

              return (
                <div 
                  key={idx}
                  className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.01] hover:border-amber-500/10 transition-all flex flex-col md:flex-row gap-4 items-start relative"
                >
                  {/* 순위 마크 표시 */}
                  <div className="w-12 h-12 rounded-xl bg-amber-500/5 border border-amber-500/10 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-amber-400 tracking-wider">RANK</span>
                    <input
                      type="number"
                      required
                      value={ent.position}
                      onChange={(e) => updateEntryRow(idx, 'position', e.target.value)}
                      className="w-8 text-center bg-transparent border-0 font-extrabold text-white text-sm focus:outline-none focus:ring-0 p-0 leading-none font-mono"
                    />
                  </div>

                  <div className="flex-grow grid grid-cols-1 md:grid-cols-4 gap-3 w-full">
                    
                    {/* A. 아이템 검색 및 매핑 선택 */}
                    <div className="md:col-span-1 relative">
                      <label className="block text-[9px] text-slate-500 font-bold mb-1">아이템 연동 *</label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={ent.itemSearchKeyword}
                          onChange={(e) => {
                            updateEntryRow(idx, 'itemSearchKeyword', e.target.value)
                            if (!e.target.value) {
                              updateEntryRow(idx, 'item_id', '')
                            }
                          }}
                          placeholder="검색어 입력..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-white/10 rounded-lg focus:border-amber-500 focus:outline-none text-slate-200"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                      </div>

                      {/* 드롭다운 매칭 제안 */}
                      {ent.itemSearchKeyword && !ent.item_id && filteredItems.length > 0 && (
                        <div className="absolute z-30 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-slate-950 p-1.5 shadow-2xl space-y-1">
                          {filteredItems.map((item: any) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                updateEntryRow(idx, 'item_id', item.id)
                                updateEntryRow(idx, 'itemSearchKeyword', item.title)
                              }}
                              className="w-full text-left px-2 py-1.5 text-[11px] rounded hover:bg-white/5 transition-colors flex items-center justify-between"
                            >
                              <span className="font-semibold text-slate-300 truncate max-w-[150px]">{item.title}</span>
                              <span className="text-[9px] text-slate-500 font-mono">({item.brand_or_creator || item.item_type})</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 매핑 완료 시 피드백 표시 */}
                      {ent.item_id ? (
                        <p className="text-[10px] text-emerald-400 font-bold mt-1 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          아이템 연결됨
                        </p>
                      ) : ent.itemSearchKeyword ? (
                        <p className="text-[10px] text-rose-400 font-bold mt-1">
                          목록에서 선택해 주세요.
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-500 mt-1">
                          아이템 명을 검색해 연동하세요.
                        </p>
                      )}
                    </div>

                    {/* B. 선정 이유 기입 */}
                    <div className="md:col-span-2">
                      <label className="block text-[9px] text-slate-500 font-bold mb-1">순위 선정 이유 및 총평 *</label>
                      <textarea
                        required
                        value={ent.reason}
                        onChange={(e) => updateEntryRow(idx, 'reason', e.target.value)}
                        placeholder="이 제품의 맛, 식감, 영양성분의 장점과 에디터 상세 평가를 적으십시오."
                        rows={2}
                        className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-white/10 rounded-lg focus:border-amber-500 focus:outline-none text-slate-200 resize-none"
                      />
                    </div>

                    {/* C. 평점 및 스폰서 */}
                    <div className="grid grid-cols-2 gap-2 md:col-span-1">
                      <div>
                        <label className="block text-[9px] text-slate-500 font-bold mb-1">에디터 점수 (Score)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={ent.editor_score}
                          onChange={(e) => updateEntryRow(idx, 'editor_score', e.target.value)}
                          placeholder="예: 9.8"
                          className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-white/10 rounded-lg focus:border-amber-500 focus:outline-none text-slate-200 font-mono"
                        />
                      </div>
                      <div className="flex flex-col justify-end pb-2 pl-2">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-400 font-bold">
                          <input
                            type="checkbox"
                            checked={ent.sponsor_flag}
                            onChange={(e) => updateEntryRow(idx, 'sponsor_flag', e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-white/10 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
                          />
                          스폰서 광고
                        </label>
                      </div>
                    </div>

                  </div>

                  {/* 삭제 버튼 */}
                  <button
                    type="button"
                    onClick={() => removeEntryRow(idx)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/10 transition-all shrink-0 self-end md:self-center"
                    title="순위 행 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 저장 완료 및 프리뷰 진행 제어 패널 */}
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-indigo-300">작업 저장 준비 완료</h3>
          <p className="text-[11px] text-slate-400 mt-1">
            순위표 엔트리와 평가 기준이 최소 1개 이상 연결되어야 일괄 저장이 수행됩니다.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/15"
          >
            <Save className="w-4 h-4" />
            {isPending ? '동기화 저장 중...' : '일괄 트랜잭션 저장'}
          </button>
        </div>
      </div>

    </form>
  )
}
