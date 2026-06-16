'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { listAdminCategories, listAdminSubcategories, createSubcategory, updateSubcategory } from '@/lib/actions/admin'
import { Layers, ArrowLeft, PlusCircle, Pencil, Save, X, Eye, EyeOff } from 'lucide-react'

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
  description: string | null
  is_visible: boolean
  sort_order: number
  categories?: {
    name: string
  } | null
}

export default function AdminSubcategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  
  // 편집/등록 관련 상태
  const [editingId, setEditingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // 폼 필드
  const [categoryId, setCategoryId] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [isVisible, setIsVisible] = useState(true)
  const [sortOrder, setSortOrder] = useState(10)

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [catData, subcatData] = await Promise.all([
        listAdminCategories(),
        listAdminSubcategories()
      ])
      setCategories(catData as Category[])
      setSubcategories(subcatData as Subcategory[])
      
      // 카테고리가 존재하면 디폴트 선택
      if (catData && catData.length > 0) {
        setCategoryId(catData[0].id)
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

  const resetForm = () => {
    setName('')
    setSlug('')
    setDescription('')
    setIsVisible(true)
    setSortOrder(10)
    setEditingId(null)
    setErrorMessage(null)
    if (categories.length > 0) {
      setCategoryId(categories[0].id)
    }
  }

  const handleEditClick = (sub: Subcategory) => {
    setEditingId(sub.id)
    setCategoryId(sub.category_id)
    setName(sub.name)
    setSlug(sub.slug)
    setDescription(sub.description || '')
    setIsVisible(sub.is_visible)
    setSortOrder(sub.sort_order)
    setErrorMessage(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!categoryId) {
      setErrorMessage('상위 카테고리를 선택해야 합니다.')
      return
    }

    const formData = {
      category_id: categoryId,
      name,
      slug: slug.trim().toLowerCase(),
      description: description || undefined,
      is_visible: isVisible,
      sort_order: Number(sortOrder)
    }

    startTransition(async () => {
      let result
      if (editingId) {
        result = await updateSubcategory(editingId, formData)
      } else {
        result = await createSubcategory(formData)
      }

      if (result.error) {
        setErrorMessage(result.error)
      } else {
        setSuccessMessage(editingId ? '서브카테고리가 수정되었습니다.' : '새 서브카테고리가 등록되었습니다.')
        resetForm()
        
        // 새로 리스트 조회
        const updatedSubcats = await listAdminSubcategories()
        setSubcategories(updatedSubcats as Subcategory[])
      }
    })
  }

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a0a0f] to-[#07070a] text-slate-100">
      <div className="max-w-6xl mx-auto">
        
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
            <Layers className="w-6 h-6 text-sky-400" />
            서브카테고리 관리 CMS
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            특정 상위 카테고리에 속한 하위 카테고리(닭가슴살, 단백질 보충제, 웹툰 등)를 추가 및 수정합니다.
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
          
          {/* 입력 / 수정 폼 */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sticky top-24">
              <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-1.5">
                {editingId ? <Pencil className="w-4 h-4 text-amber-400" /> : <PlusCircle className="w-4 h-4 text-sky-400" />}
                {editingId ? '서브카테고리 수정' : '새 서브카테고리 추가'}
              </h2>
              
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">상위 카테고리 *</label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-sky-500 focus:outline-none transition-all text-slate-200"
                  >
                    {categories.length === 0 ? (
                      <option value="">카테고리를 먼저 생성해주세요.</option>
                    ) : (
                      categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} (/{cat.slug})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">이름 *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 닭가슴살, 단백질 보충제"
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-sky-500 focus:outline-none transition-all text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">슬러그 * (영문/숫자, 상위카테고리 내에서 유일)</label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="예: chicken-breast, protein"
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-sky-500 focus:outline-none transition-all text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">설명 (선택)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="간단한 서브카테고리 설명글 기입"
                    rows={3}
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-sky-500 focus:outline-none transition-all text-slate-200 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 font-bold mb-1.5">노출 순서</label>
                    <input
                      type="number"
                      required
                      value={sortOrder}
                      onChange={(e) => setSortOrder(Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-sky-500 focus:outline-none transition-all text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 font-bold mb-1.5">공개 상태</label>
                    <div className="flex items-center h-[38px]">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={(e) => setIsVisible(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600 peer-checked:after:bg-white"></div>
                        <span className="ml-2 text-xs text-slate-300 font-semibold">{isVisible ? '공개' : '비공개'}</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={isPending || categories.length === 0}
                    className="flex-grow py-2 px-4 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 disabled:bg-sky-850 text-white transition-all flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {editingId ? '수정 완료' : '추가 등록'}
                  </button>
                  
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-slate-300 transition-all flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* 목록 테이블 */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">서브카테고리 목록</span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-bold">
                  총 {subcategories.length}개
                </span>
              </div>

              {loading ? (
                <div className="p-12 text-center text-xs text-slate-500 font-semibold">
                  서브카테고리 목록을 로딩 중입니다...
                </div>
              ) : subcategories.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500 font-semibold">
                  등록된 서브카테고리가 없습니다. 왼쪽 폼에서 새로 추가해 주세요.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.01] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-5 py-3.5 w-16">순서</th>
                        <th className="px-5 py-3.5">상위 카테고리</th>
                        <th className="px-5 py-3.5">이름 / 슬러그</th>
                        <th className="px-5 py-3.5">설명</th>
                        <th className="px-5 py-3.5 w-24">상태</th>
                        <th className="px-5 py-3.5 w-20 text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] text-xs">
                      {subcategories.map((sub) => (
                        <tr 
                          key={sub.id} 
                          className={`hover:bg-white/[0.01] transition-colors ${editingId === sub.id ? 'bg-sky-500/[0.04]' : ''}`}
                        >
                          <td className="px-5 py-4 font-mono text-slate-400">{sub.sort_order}</td>
                          <td className="px-5 py-4 text-slate-300 font-semibold">
                            {sub.categories?.name || '부모 없음'}
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-200">{sub.name}</p>
                            <p className="font-mono text-[10px] text-slate-500 mt-0.5">/{sub.slug}</p>
                          </td>
                          <td className="px-5 py-4 text-slate-400 max-w-[200px] truncate" title={sub.description || ''}>
                            {sub.description || '-'}
                          </td>
                          <td className="px-5 py-4">
                            {sub.is_visible ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                <Eye className="w-3 h-3" />
                                공개 중
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded bg-slate-500/10 border border-slate-500/20">
                                <EyeOff className="w-3 h-3" />
                                비공개
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleEditClick(sub)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/10 transition-all inline-flex items-center justify-center"
                              title="수정"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
