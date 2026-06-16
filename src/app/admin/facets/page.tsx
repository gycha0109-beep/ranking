'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { listFacetGroups, createFacetGroup, createFacet, updateFacet } from '@/lib/actions/admin'
import { Tag, ArrowLeft, PlusCircle, Pencil, Save, X, Layers, Settings } from 'lucide-react'

interface Facet {
  id: string
  facet_group_id: string
  name: string
  slug: string
  description: string | null
}

interface FacetGroup {
  id: string
  code: string
  name: string
  description: string | null
  applies_to: 'ranking' | 'item' | 'both'
  facets?: Facet[]
}

export default function AdminFacetsPage() {
  const [facetGroups, setFacetGroups] = useState<FacetGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // 피드백 메시지
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // A. 페이셋 그룹 생성 폼 상태
  const [groupCode, setGroupCode] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [appliesTo, setAppliesTo] = useState<'ranking' | 'item' | 'both'>('both')

  // B. 페이셋 생성/수정 폼 상태
  const [editingFacetId, setEditingFacetId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [facetName, setFacetName] = useState('')
  const [facetSlug, setFacetSlug] = useState('')
  const [facetDesc, setFacetDesc] = useState('')

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const data = await listFacetGroups()
      setFacetGroups(data as FacetGroup[])
      if (data && data.length > 0) {
        setSelectedGroupId(data[0].id)
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

  const resetGroupForm = () => {
    setGroupCode('')
    setGroupName('')
    setGroupDesc('')
    setAppliesTo('both')
  }

  const resetFacetForm = () => {
    setFacetName('')
    setFacetSlug('')
    setFacetDesc('')
    setEditingFacetId(null)
    if (facetGroups.length > 0) {
      setSelectedGroupId(facetGroups[0].id)
    }
  }

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const formData = {
      code: groupCode.trim().toLowerCase(),
      name: groupName,
      description: groupDesc || undefined,
      applies_to: appliesTo
    }

    startTransition(async () => {
      const result = await createFacetGroup(formData)
      if (result.error) {
        setErrorMessage(result.error)
      } else {
        setSuccessMessage('새 페이셋 그룹이 생성되었습니다.')
        resetGroupForm()
        fetchInitialData()
      }
    })
  }

  const handleFacetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    startTransition(async () => {
      let result
      if (editingFacetId) {
        // 수정
        result = await updateFacet(editingFacetId, {
          name: facetName,
          slug: facetSlug.trim().toLowerCase(),
          description: facetDesc || undefined
        })
      } else {
        // 생성
        if (!selectedGroupId) {
          setErrorMessage('페이셋 그룹을 지정해야 합니다.')
          return
        }
        result = await createFacet({
          facet_group_id: selectedGroupId,
          name: facetName,
          slug: facetSlug.trim().toLowerCase(),
          description: facetDesc || undefined
        })
      }

      if (result.error) {
        setErrorMessage(result.error)
      } else {
        setSuccessMessage(editingFacetId ? '페이셋 태그가 수정되었습니다.' : '새 페이셋 태그가 등록되었습니다.')
        resetFacetForm()
        fetchInitialData()
      }
    })
  }

  const handleEditFacetClick = (fac: Facet, groupId: string) => {
    setEditingFacetId(fac.id)
    setSelectedGroupId(groupId)
    setFacetName(fac.name)
    setFacetSlug(fac.slug)
    setFacetDesc(fac.description || '')
    setErrorMessage(null)
  }

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a0a0f] to-[#07070a] text-slate-100">
      <div className="max-w-7xl mx-auto">
        
        {/* 뒤로가기 링크 */}
        <Link 
          href="/admin" 
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white mb-6 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 px-3 py-1.5 rounded-lg transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          대시보드로 돌아가기
        </Link>

        {/* 상단 타이틀 */}
        <div className="mb-8">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Tag className="w-6 h-6 text-emerald-400" />
            페이셋(Facet) 메타 데이터 CMS
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            아이템과 랭킹의 필터 태그로 사용되는 페이셋 그룹(예: 브랜드, 제형) 및 소속 속성(예: 한끼통살, 수비드)을 관리합니다.
          </p>
        </div>

        {/* 피드백 메시지 */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-xs font-bold">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="mb-6 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs font-bold">
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 왼쪽 컬럼: 생성/수정 제어 폼 2개 */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* 1. 페이셋 그룹 생성 폼 */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h2 className="text-xs font-bold text-slate-200 mb-4 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-indigo-400" />
                1단계. 페이셋 그룹 생성
              </h2>
              
              <form onSubmit={handleGroupSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">그룹 코드 * (영문고유, 예: brand)</label>
                  <input
                    type="text"
                    required
                    value={groupCode}
                    onChange={(e) => setGroupCode(e.target.value)}
                    placeholder="예: brand, form, purpose"
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">그룹명 * (예: 브랜드, 제형)</label>
                  <input
                    type="text"
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="예: 브랜드, 형태, 다이어트 여부"
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-400 font-bold mb-1.5">적용 대상</label>
                    <select
                      value={appliesTo}
                      onChange={(e) => setAppliesTo(e.target.value as any)}
                      className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
                    >
                      <option value="both">모두 적용 (both)</option>
                      <option value="item">아이템만 적용 (item)</option>
                      <option value="ranking">랭킹만 적용 (ranking)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">그룹 설명 (선택)</label>
                  <input
                    type="text"
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    placeholder="설명 문구 기입"
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-slate-200"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 text-white transition-all flex items-center justify-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  그룹 생성하기
                </button>
              </form>
            </div>

            {/* 2. 페이셋 태그 생성/수정 폼 */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h2 className="text-xs font-bold text-slate-200 mb-4 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-emerald-400" />
                {editingFacetId ? '2단계. 페이셋 태그 수정' : '2단계. 페이셋 태그 등록'}
              </h2>

              <form onSubmit={handleFacetSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">페이셋 그룹 *</label>
                  <select
                    required
                    disabled={!!editingFacetId}
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-emerald-500 focus:outline-none transition-all text-slate-200 disabled:opacity-50"
                  >
                    {facetGroups.length === 0 ? (
                      <option value="">그룹을 먼저 생성하세요.</option>
                    ) : (
                      facetGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.code})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">태그명 * (예: 한끼통살, 네이버웹툰)</label>
                  <input
                    type="text"
                    required
                    value={facetName}
                    onChange={(e) => setFacetName(e.target.value)}
                    placeholder="예: 훈제, 수비드, 네이버"
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-emerald-500 focus:outline-none transition-all text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">슬러그 * (고유 식별)</label>
                  <input
                    type="text"
                    required
                    value={facetSlug}
                    onChange={(e) => setFacetSlug(e.target.value)}
                    placeholder="예: sous-vide, naver"
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-emerald-500 focus:outline-none transition-all text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">태그 설명 (선택)</label>
                  <input
                    type="text"
                    value={facetDesc}
                    onChange={(e) => setFacetDesc(e.target.value)}
                    placeholder="상세 설명 기입"
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-emerald-500 focus:outline-none transition-all text-slate-200"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isPending || (!editingFacetId && facetGroups.length === 0)}
                    className="flex-grow py-2 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-850 text-white transition-all flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {editingFacetId ? '태그 수정 완료' : '태그 추가 등록'}
                  </button>

                  {editingFacetId && (
                    <button
                      type="button"
                      onClick={resetFacetForm}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-slate-300 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </form>
            </div>

          </div>

          {/* 오른쪽 컬럼: 그룹 및 하위 페이셋 목록 카드 그룹 */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5">
              <h2 className="text-xs font-bold text-slate-300 mb-6 uppercase tracking-wider">
                페이셋 그룹 및 태그 구조 목록
              </h2>

              {loading ? (
                <div className="p-12 text-center text-xs text-slate-500 font-semibold">
                  페이셋 데이터를 로드 중입니다...
                </div>
              ) : facetGroups.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500 font-semibold">
                  생성된 페이셋 그룹이 없습니다. 왼쪽 폼에서 먼저 그룹을 만들어 보세요.
                </div>
              ) : (
                <div className="space-y-6">
                  {facetGroups.map((group) => (
                    <div 
                      key={group.id} 
                      className="p-5 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:border-indigo-500/10 transition-all"
                    >
                      {/* 그룹 헤더 */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3 mb-4">
                        <div>
                          <span className="text-xs font-extrabold text-indigo-400 font-mono uppercase mr-2 bg-indigo-500/5 px-2 py-0.5 border border-indigo-500/10 rounded">
                            {group.code}
                          </span>
                          <span className="text-sm font-bold text-slate-200">{group.name}</span>
                          <p className="text-[10px] text-slate-500 mt-1">{group.description || '설명 없음'}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          대상: {group.applies_to === 'both' ? '모두' : group.applies_to === 'item' ? '아이템' : '랭킹'}
                        </span>
                      </div>

                      {/* 하위 페이셋 칩셋 */}
                      <div>
                        {group.facets && group.facets.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {group.facets.map((fac) => (
                              <div
                                key={fac.id}
                                className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                  editingFacetId === fac.id 
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                                    : 'bg-slate-900 border-white/[0.04] text-slate-300 hover:border-white/10'
                                }`}
                              >
                                <span>{fac.name}</span>
                                <span className="font-mono text-[9px] text-slate-500">/{fac.slug}</span>
                                <button
                                  type="button"
                                  onClick={() => handleEditFacetClick(fac, group.id)}
                                  className="p-0.5 rounded hover:bg-white/10 text-slate-500 hover:text-amber-400 transition-all shrink-0"
                                  title="수정"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-600 italic">
                            이 그룹에 등록된 하위 페이셋 태그가 없습니다.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
