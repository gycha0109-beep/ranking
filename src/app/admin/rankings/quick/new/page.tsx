'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { listAdminCategories, createQuickRanking } from '@/lib/actions/admin'
import { FileSpreadsheet, ArrowLeft, Save, Sparkles } from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
}

interface EntryInput {
  rank_position: number
  item_name: string
  reason: string
}

export default function AdminQuickNewRankingPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // 피드백 메시지
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // 폼 상태
  const [categoryId, setCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [entries, setEntries] = useState<EntryInput[]>(
    Array.from({ length: 10 }, (_, i) => ({
      rank_position: i + 1,
      item_name: '',
      reason: ''
    }))
  )

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const cats = await listAdminCategories()
      setCategories(cats as Category[])

      if (cats && cats.length > 0) {
        setCategoryId(cats[0].id)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!categoryId) {
      setErrorMessage('카테고리를 선택해야 합니다.')
      return
    }

    if (!title.trim()) {
      setErrorMessage('제목을 입력해야 합니다.')
      return
    }

    if (!summary.trim()) {
      setErrorMessage('요약 설명을 입력해야 합니다.')
      return
    }

    // Filter valid entries
    const validEntries = entries.filter(item => item.item_name && item.item_name.trim() !== '')

    if (validEntries.length === 0) {
      setErrorMessage('최소 1개 이상의 아이템 순위 정보를 입력해야 합니다.')
      return
    }

    // Validate duplicate rank positions
    const positions = validEntries.map(item => Number(item.rank_position))
    const uniquePositions = new Set(positions)
    if (positions.some(pos => pos <= 0 || isNaN(pos))) {
      setErrorMessage('순위는 1 이상의 정수여야 합니다.')
      return
    }
    if (uniquePositions.size !== positions.length) {
      setErrorMessage('순위표에 중복된 순위가 존재합니다. 고유하게 구성해 주세요.')
      return
    }

    // Validate duplicate item names (case-insensitive & trimmed)
    const itemNames = validEntries.map(item => item.item_name.trim().toLowerCase())
    const uniqueItemNames = new Set(itemNames)
    if (uniqueItemNames.size !== itemNames.length) {
      setErrorMessage('입력된 순위표에 중복된 아이템 명이 존재합니다.')
      return
    }

    const formData = {
      title: title.trim(),
      category_id: categoryId,
      summary: summary.trim(),
      entries: validEntries
    }

    startTransition(async () => {
      const result = await createQuickRanking(formData)
      if (result.error) {
        setErrorMessage(result.error)
      } else {
        // 성공 시 생성된 랭킹 문서의 preview 화면으로 바로 이동!
        const newRankingId = result.rankingId
        router.push(`/admin/rankings/${newRankingId}/preview`)
      }
    })
  }

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a0a0f] to-[#07070a] text-slate-100">
      <div className="max-w-4xl mx-auto">
        
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
            <Sparkles className="w-6 h-6 text-purple-400" />
            랭킹 간편 작성 (Quick Draft Create)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            필수 항목만 입력하여 새로운 랭킹 문서를 빠르게 생성합니다. 기준(Criteria)은 기본값으로 자동 삽입됩니다.
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
          <div className="p-12 text-center text-xs text-slate-500 font-semibold border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
            등록된 카테고리가 존재하지 않아 랭킹을 생성할 수 없습니다.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* 기본 정보 구역 */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4 shadow-lg">
              <h2 className="text-sm font-bold text-slate-200 border-b border-white/[0.06] pb-2">랭킹 기본 정보</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">카테고리 *</label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-purple-500 focus:outline-none transition-all text-slate-200"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} (/{cat.slug})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">랭킹 제목 *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예: 2026 최고의 닭가슴살 추천 TOP 10"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-purple-500 focus:outline-none transition-all text-slate-200"
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
                  placeholder="예: 맛, 식감, 성분 배점을 기준으로 선정한 최고의 닭가슴살 랭킹입니다."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-purple-500 focus:outline-none transition-all text-slate-200"
                />
              </div>
            </div>

            {/* 순위표 입력 구역 */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4 shadow-lg">
              <div>
                <h2 className="text-sm font-bold text-slate-200">순위 리스트 입력 (기본 10개)</h2>
                <p className="text-[11px] text-slate-500 mt-1">
                  아이템 명이 비어있는 행은 제외됩니다. 최소 1개 이상의 순위를 완성해야 저장됩니다.
                </p>
              </div>

              <div className="space-y-3">
                {entries.map((entry, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 items-center bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.03] p-3 rounded-xl transition-all">
                    
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[9px] text-slate-500 font-bold mb-1 text-center">순위</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={entry.rank_position}
                        onChange={(e) => {
                          const updated = [...entries]
                          updated[index].rank_position = Number(e.target.value)
                          setEntries(updated)
                        }}
                        className="w-full px-2 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg focus:border-purple-500 focus:outline-none transition-all text-slate-200 text-center"
                      />
                    </div>
                    
                    <div className="col-span-10 sm:col-span-4">
                      <label className="block text-[9px] text-slate-500 font-bold mb-1">아이템 명 *</label>
                      <input
                        type="text"
                        placeholder="예: 한끼통살 닭가슴살 수비드"
                        value={entry.item_name}
                        onChange={(e) => {
                          const updated = [...entries]
                          updated[index].item_name = e.target.value
                          setEntries(updated)
                        }}
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg focus:border-purple-500 focus:outline-none transition-all text-slate-200"
                      />
                    </div>

                    <div className="col-span-12 sm:col-span-7">
                      <label className="block text-[9px] text-slate-500 font-bold mb-1">선정 및 평가 이유</label>
                      <input
                        type="text"
                        placeholder="예: 수비드 공법으로 조리되어 촉촉하며 소스의 맛 밸런스가 최고입니다."
                        value={entry.reason}
                        onChange={(e) => {
                          const updated = [...entries]
                          updated[index].reason = e.target.value
                          setEntries(updated)
                        }}
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg focus:border-purple-500 focus:outline-none transition-all text-slate-200"
                      />
                    </div>

                  </div>
                ))}
              </div>
            </div>

            {/* 작업 제어 영역 */}
            <div className="flex justify-end gap-3">
              <Link
                href="/admin/rankings"
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 transition-all"
              >
                취소
              </Link>
              
              <button
                type="submit"
                disabled={isPending}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 border border-purple-500/30 text-white transition-all flex items-center gap-1.5 shadow-lg shadow-purple-600/15 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {isPending ? '저장 및 빌드 중...' : '간편 드래프트 생성'}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  )
}
