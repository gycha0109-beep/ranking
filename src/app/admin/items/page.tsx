'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { listAdminItems, listFacetGroups, createItem, updateItem } from '@/lib/actions/admin'
import { Package, ArrowLeft, PlusCircle, Pencil, Save, X, Eye, EyeOff, Layers, ExternalLink } from 'lucide-react'

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

interface ItemFacetMapping {
  facet_id: string
}

interface Item {
  id: string
  title: string
  slug: string
  description: string | null
  item_type: string
  image_url: string | null
  brand_or_creator: string | null
  external_url: string | null
  affiliate_url: string | null
  status: 'active' | 'hidden' | 'archived'
  created_at: string
  item_facets?: ItemFacetMapping[]
}

export default function AdminItemsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [facetGroups, setFacetGroups] = useState<FacetGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // 피드백 메시지
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // 폼 상태
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [itemType, setItemType] = useState('food') // 디폴트 유형
  const [imageUrl, setImageUrl] = useState('')
  const [brandOrCreator, setBrandOrCreator] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [affiliateUrl, setAffiliateUrl] = useState('')
  const [status, setStatus] = useState<'active' | 'hidden' | 'archived'>('active')
  
  // 체크된 페이셋 ID 목록
  const [checkedFacetIds, setCheckedFacetIds] = useState<string[]>([])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [itemsData, facetGroupsData] = await Promise.all([
        listAdminItems(),
        listFacetGroups()
      ])
      setItems(itemsData as Item[])
      
      // 아이템에 적용 가능한 페이셋 그룹만 필터링 (applies_to === 'item' 또는 'both')
      const itemFacets = (facetGroupsData as FacetGroup[]).filter(
        g => g.applies_to === 'item' || g.applies_to === 'both'
      )
      setFacetGroups(itemFacets)
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
    setTitle('')
    setSlug('')
    setDescription('')
    setItemType('food')
    setImageUrl('')
    setBrandOrCreator('')
    setExternalUrl('')
    setAffiliateUrl('')
    setStatus('active')
    setCheckedFacetIds([])
    setEditingId(null)
    setErrorMessage(null)
  }

  const handleEditClick = (item: Item) => {
    setEditingId(item.id)
    setTitle(item.title)
    setSlug(item.slug)
    setDescription(item.description || '')
    setItemType(item.item_type)
    setImageUrl(item.image_url || '')
    setBrandOrCreator(item.brand_or_creator || '')
    setExternalUrl(item.external_url || '')
    setAffiliateUrl(item.affiliate_url || '')
    setStatus(item.status)
    
    // 이 아이템에 매핑된 페이셋 복원
    const mappedIds = item.item_facets?.map(f => f.facet_id) || []
    setCheckedFacetIds(mappedIds)
    setErrorMessage(null)
  }

  const handleFacetCheckboxChange = (facetId: string, isChecked: boolean) => {
    if (isChecked) {
      setCheckedFacetIds(prev => [...prev, facetId])
    } else {
      setCheckedFacetIds(prev => prev.filter(id => id !== facetId))
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const formData = {
      title,
      slug: slug.trim().toLowerCase(),
      description: description || undefined,
      item_type: itemType,
      image_url: imageUrl || undefined,
      brand_or_creator: brandOrCreator || undefined,
      external_url: externalUrl || undefined,
      affiliate_url: affiliateUrl || undefined,
      status,
      facet_ids: checkedFacetIds
    }

    startTransition(async () => {
      let result
      if (editingId) {
        result = await updateItem(editingId, formData)
      } else {
        result = await createItem(formData)
      }

      if (result.error) {
        setErrorMessage(result.error)
      } else {
        setSuccessMessage(editingId ? '아이템이 수정되었습니다.' : '새 아이템이 성공적으로 등록되었습니다.')
        resetForm()
        
        // 아이템 목록 새로고침
        const updatedItems = await listAdminItems()
        setItems(updatedItems as Item[])
      }
    })
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
            <Package className="w-6 h-6 text-amber-400" />
            아이템(상품) 정보 관리 CMS
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            순위표(Ranking Entries)에 탑재할 구체적인 상품, 콘텐츠, 게임 등을 등록하고 다중 페이셋 속성 태그를 맵핑합니다.
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
          
          {/* 입력 / 수정 폼 (왼쪽 컬럼) */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-1.5">
                {editingId ? <Pencil className="w-4 h-4 text-amber-400" /> : <PlusCircle className="w-4 h-4 text-amber-400" />}
                {editingId ? '아이템 수정' : '새 아이템 추가'}
              </h2>

              <form onSubmit={handleSave} className="space-y-4">
                
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">아이템 종류 *</label>
                  <select
                    required
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-amber-500 focus:outline-none transition-all text-slate-200"
                  >
                    <option value="food">식품 (food)</option>
                    <option value="content">콘텐츠 (content)</option>
                    <option value="game">게임 (game)</option>
                    <option value="cosmetics">화장품 (cosmetics)</option>
                    <option value="it_device">IT 기기 (it_device)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">아이템 명 *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예: 한끼통살 수비드 닭가슴살 허니소이"
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-amber-500 focus:outline-none transition-all text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">고유 슬러그 * (전역에서 고유)</label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="예: hankki-soy-chicken"
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-amber-500 focus:outline-none transition-all text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">브랜드 / 제작사 / 크리에이터</label>
                  <input
                    type="text"
                    value={brandOrCreator}
                    onChange={(e) => setBrandOrCreator(e.target.value)}
                    placeholder="예: 한끼통살, 카카오"
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-amber-500 focus:outline-none transition-all text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">이미지 URL (텍스트 주소 입력)</label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/... 또는 외부 이미지 경로"
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-amber-500 focus:outline-none transition-all text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">상세 설명</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="성분, 용량 등 부연 정보를 기입합니다."
                    rows={3}
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-amber-500 focus:outline-none transition-all text-slate-200 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">공식 홈페이지 주소 (URL)</label>
                  <input
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://brand.com/item"
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-amber-500 focus:outline-none transition-all text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">최저가 제휴 링크 (Affiliate URL)</label>
                  <input
                    type="url"
                    value={affiliateUrl}
                    onChange={(e) => setAffiliateUrl(e.target.value)}
                    placeholder="https://shopping.naver.com/... (구매 유도 링크)"
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-amber-500 focus:outline-none transition-all text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">활성화 상태</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-amber-500 focus:outline-none transition-all text-slate-200"
                  >
                    <option value="active">활성 (active - 공개 노출)</option>
                    <option value="hidden">숨김 (hidden - 어드민만 조회)</option>
                    <option value="archived">보관 (archived - 아카이브)</option>
                  </select>
                </div>

                {/* 다중 페이셋 태그 선택 영역 */}
                <div className="pt-2 border-t border-white/5">
                  <label className="block text-xs text-slate-300 font-bold mb-2 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    관련 페이셋 태그 연동
                  </label>
                  
                  {facetGroups.length === 0 ? (
                    <div className="text-[10px] text-slate-500 italic">
                      적용 가능한 페이셋 그룹이 없습니다. 페이셋 관리를 먼저 수행하세요.
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-56 overflow-y-auto pr-1 border border-white/5 bg-slate-900/30 p-3 rounded-xl">
                      {facetGroups.map((group) => (
                        <div key={group.id} className="space-y-1.5">
                          <p className="text-[10px] font-black text-indigo-400 font-mono uppercase bg-indigo-500/5 px-1.5 py-0.5 rounded border border-indigo-500/10 inline-block">
                            {group.name}
                          </p>
                          <div className="grid grid-cols-2 gap-2 pl-1">
                            {group.facets?.map((fac) => (
                              <label 
                                key={fac.id} 
                                className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 hover:text-white"
                              >
                                <input
                                  type="checkbox"
                                  checked={checkedFacetIds.includes(fac.id)}
                                  onChange={(e) => handleFacetCheckboxChange(fac.id, e.target.checked)}
                                  className="w-3.5 h-3.5 rounded border-white/10 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
                                />
                                <span className="truncate">{fac.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-grow py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 disabled:bg-amber-850 text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/10"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {editingId ? '수정 사항 저장' : '아이템 등록'}
                  </button>

                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="py-2.5 px-3 rounded-xl text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-slate-300 transition-all flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

              </form>
            </div>
          </div>

          {/* 목록 테이블 (오른쪽 2컬럼) */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">등록 상품/아이템 목록</span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-bold">
                  총 {items.length}개
                </span>
              </div>

              {loading ? (
                <div className="p-12 text-center text-xs text-slate-500 font-semibold">
                  아이템 목록을 로드 중입니다...
                </div>
              ) : items.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500 font-semibold">
                  등록된 아이템이 없습니다. 왼쪽 폼에서 첫 아이템을 등록해 주세요.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.01] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-5 py-3.5">아이템 정보</th>
                        <th className="px-5 py-3.5">분류 / 브랜드</th>
                        <th className="px-5 py-3.5">매핑 페이셋</th>
                        <th className="px-5 py-3.5 w-20">상태</th>
                        <th className="px-5 py-3.5 w-20 text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] text-xs">
                      {items.map((item) => (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-white/[0.01] transition-colors ${editingId === item.id ? 'bg-amber-500/[0.04]' : ''}`}
                        >
                          
                          {/* 메인 텍스트 및 썸네일 */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/5 bg-slate-900 shrink-0 flex items-center justify-center">
                                {item.image_url ? (
                                  <img 
                                    src={item.image_url} 
                                    alt={item.title} 
                                    className="w-full h-full object-cover" 
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=100'
                                    }}
                                  />
                                ) : (
                                  <Package className="w-4 h-4 text-slate-600" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-200 truncate max-w-[220px]" title={item.title}>
                                  {item.title}
                                </p>
                                <p className="font-mono text-[9px] text-slate-500 mt-0.5 truncate max-w-[220px]">
                                  /{item.slug}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* 분류 / 브랜드 */}
                          <td className="px-5 py-4">
                            <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-500/5 px-2 py-0.5 border border-amber-500/10 rounded mr-2">
                              {item.item_type}
                            </span>
                            <span className="text-slate-300 font-semibold">{item.brand_or_creator || '-'}</span>
                          </td>

                          {/* 페이셋 태그 개수 */}
                          <td className="px-5 py-4 font-semibold text-slate-400">
                            연동 태그: {item.item_facets?.length || 0}개
                          </td>

                          {/* 활성 상태 */}
                          <td className="px-5 py-4">
                            {item.status === 'active' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                <Eye className="w-3 h-3" />
                                활성
                              </span>
                            ) : item.status === 'hidden' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded bg-slate-500/10 border border-slate-500/20">
                                <EyeOff className="w-3 h-3" />
                                숨김
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                                <X className="w-3 h-3" />
                                보관
                              </span>
                            )}
                          </td>

                          {/* 작업 버튼 */}
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleEditClick(item)}
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
