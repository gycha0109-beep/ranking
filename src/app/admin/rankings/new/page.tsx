'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { listAdminCategories, listAdminSubcategories, createRankingDraft } from '@/lib/actions/admin'
import { FileSpreadsheet, ArrowLeft, PlusCircle, Save, FolderKanban, Layers, FileEdit } from 'lucide-react'

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

type RankingType = 'editor_pick' | 'popularity' | 'quality' | 'purpose' | 'metric' | 'user_vote' | 'sponsored'

export default function AdminNewRankingPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([])
  const [filteredSubcategories, setFilteredSubcategories] = useState<Subcategory[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // 피드백 메시지
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // 폼 상태
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [summary, setSummary] = useState('')
  const [rankingType, setRankingType] = useState<RankingType>('editor_pick')

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [cats, subcats] = await Promise.all([
        listAdminCategories(),
        listAdminSubcategories()
      ])
      setCategories(cats as Category[])
      setAllSubcategories(subcats as Subcategory[])

      if (cats && cats.length > 0) {
        setCategoryId(cats[0].id)
        // 서브카테고리 필터 적용
        const filtered = (subcats as Subcategory[]).filter(s => s.category_id === cats[0].id)
        setFilteredSubcategories(filtered)
        if (filtered.length > 0) {
          setSubcategoryId(filtered[0].id)
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInitialData()
  }, [])

  // 카테고리 변경 시 서브카테고리 필터링
  const handleCategoryChange = (catId: string) => {
    setCategoryId(catId)
    const filtered = allSubcategories.filter(s => s.category_id === catId)
    setFilteredSubcategories(filtered)
    if (filtered.length > 0) {
      setSubcategoryId(filtered[0].id)
    } else {
      setSubcategoryId('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!categoryId) {
      setErrorMessage('카테고리를 선택해야 합니다.')
      return
    }

    const formData = {
      category_id: categoryId,
      subcategory_id: subcategoryId || undefined,
      title,
      slug: slug.trim().toLowerCase(),
      summary,
      ranking_type: rankingType
    }

    startTransition(async () => {
      const result = await createRankingDraft(formData as Parameters<typeof createRankingDraft>[0])
      if (result.error) {
        setErrorMessage(result.error)
      } else {
        // 성공 시 편집기 화면으로 바로 이동! (E2E 플로우 활성화)
        const newRankingId = result.data?.id
        router.push(`/admin/rankings/${newRankingId}/edit`)
      }
    })
  }

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a0a0f] to-[#07070a] text-slate-100">
      <div className="max-w-3xl mx-auto">
        
        {/* 뒤로가기 링크 */}
        <Link 
          href="/admin/rankings" 
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white mb-6 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 px-3 py-1.5 rounded-lg transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          랭킹 목록으로 돌아가기
        </Link>

        {/* 상단 타이틀 */}
        <div className="mb-8">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <PlusCircle className="w-6 h-6 text-indigo-400" />
            새 랭킹 드래프트 기획 생성
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            랭킹 문서의 기본 뼈대를 생성합니다. 생성된 후에 순위 엔트리와 평가 기준을 상세히 편집할 수 있습니다.
          </p>
        </div>

        {/* 피드백 에러 */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-xs font-bold">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 font-semibold border border-white/5 rounded-2xl bg-white/[0.01]">
            필수 구성 데이터를 조회 중입니다...
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 font-semibold border border-dashed border-white/10 rounded-2xl bg-white/[0.01] space-y-4">
            <p>등록된 카테고리가 존재하지 않아 랭킹을 생성할 수 없습니다.</p>
            <Link
              href="/admin/categories"
              className="inline-block px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-all"
            >
              카테고리 먼저 등록하러 가기
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* 분류 정보 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5 flex items-center gap-1">
                    <FolderKanban className="w-3.5 h-3.5 text-slate-500" />
                    대분류 카테고리 *
                  </label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} (/{cat.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    소분류 서브카테고리
                  </label>
                  <select
                    value={subcategoryId}
                    onChange={(e) => setSubcategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
                  >
                    <option value="">서브카테고리 없음 (대분류 단독)</option>
                    {filteredSubcategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} (/{sub.slug})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 랭킹 정보 */}
              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1.5">랭킹 주제 제목 *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 2026년 국내 맛있는 수비드 닭가슴살 랭킹 추천"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1.5">영문 고유 슬러그 * (URL 주소에 반영)</label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="예: best-sous-vide-chicken"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1.5">랭킹 기획 설명 요약 *</label>
                <textarea
                  required
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="랭킹에 대한 대표 핵심 소개글을 간결하게 한두 줄로 입력합니다."
                  rows={2}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1.5">랭킹 판정 유형 *</label>
                <select
                  required
                  value={rankingType}
                  onChange={(e) => setRankingType(e.target.value as RankingType)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
                >
                  <option value="editor_pick">에디터 추천 (editor_pick)</option>
                  <option value="popularity">인기순 (popularity)</option>
                  <option value="quality">성분/품질비교 (quality)</option>
                  <option value="purpose">특수목적용 (purpose)</option>
                  <option value="metric">공식 지표 (metric)</option>
                  <option value="user_vote">유저투표 (user_vote)</option>
                  <option value="sponsored">스폰서십 (sponsored)</option>
                </select>
              </div>

              {/* 생성 버튼 */}
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/15"
              >
                <FileEdit className="w-4 h-4" />
                드래프트 기획 생성 및 편집기로 이동
              </button>

            </form>
          </div>
        )}

      </div>
    </div>
  )
}