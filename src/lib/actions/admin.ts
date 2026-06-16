'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// RLS를 완벽하게 준수하기 위해 createClient()로 획득한 세션을 기반으로 실행함.
// 현재 사용자가 어드민인지 검증하는 내부 헬퍼
async function ensureAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()

  if (!roleData) {
    throw new Error('관리자 권한이 없습니다.')
  }
  return user
}

/* ==========================================
 * 1. CATEGORY ACTIONS
 * ========================================== */

export async function listAdminCategories() {
  const supabase = await createClient()
  await ensureAdmin(supabase)
  
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

export async function createCategory(formData: { name: string; slug: string; description?: string; is_visible: boolean; sort_order: number }) {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  if (!formData.name || !formData.slug) {
    return { error: '이름과 슬러그는 필수 입력 사항입니다.' }
  }

  const { data, error } = await supabase
    .from('categories')
    .insert([formData])
    .select()
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return { error: '이미 존재하는 슬러그입니다. 다른 슬러그를 사용해 주세요.' }
    }
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true, data }
}

export async function updateCategory(id: string, formData: { name: string; slug: string; description?: string; is_visible: boolean; sort_order: number }) {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  const { data, error } = await supabase
    .from('categories')
    .update(formData)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return { error: '이미 존재하는 슬러그입니다. 다른 슬러그를 사용해 주세요.' }
    }
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true, data }
}

/* ==========================================
 * 2. SUBCATEGORY ACTIONS
 * ========================================== */

export async function listAdminSubcategories() {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  const { data, error } = await supabase
    .from('subcategories')
    .select('*, categories(name)')
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

export async function createSubcategory(formData: { category_id: string; name: string; slug: string; description?: string; is_visible: boolean; sort_order: number }) {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  if (!formData.category_id || !formData.name || !formData.slug) {
    return { error: '상위 카테고리, 이름, 슬러그는 필수 입력 사항입니다.' }
  }

  const { data, error } = await supabase
    .from('subcategories')
    .insert([formData])
    .select()
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return { error: '이 카테고리 내에 이미 존재하는 서브슬러그입니다.' }
    }
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true, data }
}

export async function updateSubcategory(id: string, formData: { category_id: string; name: string; slug: string; description?: string; is_visible: boolean; sort_order: number }) {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  const { data, error } = await supabase
    .from('subcategories')
    .update(formData)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return { error: '이 카테고리 내에 이미 존재하는 서브슬러그입니다.' }
    }
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true, data }
}

/* ==========================================
 * 3. FACETS ACTIONS
 * ========================================== */

export async function listFacetGroups() {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  const { data, error } = await supabase
    .from('facet_groups')
    .select('*, facets(*)')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

export async function createFacetGroup(formData: { code: string; name: string; description?: string; applies_to: 'ranking' | 'item' | 'both' }) {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  if (!formData.code || !formData.name) {
    return { error: '코드와 이름은 필수 입력 사항입니다.' }
  }

  const { data, error } = await supabase
    .from('facet_groups')
    .insert([formData])
    .select()
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return { error: '이미 존재하는 페이셋 그룹 코드입니다.' }
    }
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true, data }
}

export async function createFacet(formData: { facet_group_id: string; name: string; slug: string; description?: string }) {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  if (!formData.facet_group_id || !formData.name || !formData.slug) {
    return { error: '그룹 선택, 이름, 슬러그는 필수 입력 사항입니다.' }
  }

  const { data, error } = await supabase
    .from('facets')
    .insert([formData])
    .select()
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return { error: '이 그룹 내에 이미 존재하는 페이셋 슬러그입니다.' }
    }
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true, data }
}

export async function updateFacet(id: string, formData: { name: string; slug: string; description?: string }) {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  const { data, error } = await supabase
    .from('facets')
    .update(formData)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return { error: '이미 존재하는 슬러그입니다. 다른 슬러그를 사용해 주세요.' }
    }
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true, data }
}

/* ==========================================
 * 4. ITEM ACTIONS
 * ========================================== */

export async function listAdminItems() {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  const { data, error } = await supabase
    .from('items')
    .select('*, item_facets(facet_id)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function createItem(formData: {
  title: string
  slug: string
  description?: string
  item_type: string
  image_url?: string
  brand_or_creator?: string
  external_url?: string
  affiliate_url?: string
  status: 'active' | 'hidden' | 'archived'
  facet_ids?: string[]
}) {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  if (!formData.title || !formData.slug || !formData.item_type) {
    return { error: '이름, 슬러그, 아이템 종류는 필수 입력 사항입니다.' }
  }

  // A. 아이템 정보 등록
  const { data: item, error: itemError } = await supabase
    .from('items')
    .insert([{
      title: formData.title,
      slug: formData.slug,
      description: formData.description,
      item_type: formData.item_type,
      image_url: formData.image_url,
      brand_or_creator: formData.brand_or_creator,
      external_url: formData.external_url,
      affiliate_url: formData.affiliate_url,
      status: formData.status
    }])
    .select()
    .maybeSingle()

  if (itemError) {
    if (itemError.code === '23505') {
      return { error: '이미 존재하는 아이템 슬러그입니다. 전역적으로 고유해야 합니다.' }
    }
    return { error: itemError.message }
  }

  // B. 연결된 페이셋(Facets) 다중 매핑 등록
  if (formData.facet_ids && formData.facet_ids.length > 0 && item) {
    const itemFacets = formData.facet_ids.map(fId => ({
      item_id: item.id,
      facet_id: fId
    }))

    const { error: facetError } = await supabase
      .from('item_facets')
      .insert(itemFacets)

    if (facetError) {
      return { error: `아이템은 등록되었으나 페이셋 연결 중 오류가 발생했습니다: ${facetError.message}` }
    }
  }

  revalidatePath('/', 'layout')
  return { success: true, data: item }
}

export async function updateItem(id: string, formData: {
  title: string
  slug: string
  description?: string
  item_type: string
  image_url?: string
  brand_or_creator?: string
  external_url?: string
  affiliate_url?: string
  status: 'active' | 'hidden' | 'archived'
  facet_ids?: string[]
}) {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  // A. 아이템 기본 정보 업데이트
  const { data: item, error: itemError } = await supabase
    .from('items')
    .update({
      title: formData.title,
      slug: formData.slug,
      description: formData.description,
      item_type: formData.item_type,
      image_url: formData.image_url,
      brand_or_creator: formData.brand_or_creator,
      external_url: formData.external_url,
      affiliate_url: formData.affiliate_url,
      status: formData.status
    })
    .eq('id', id)
    .select()
    .maybeSingle()

  if (itemError) {
    if (itemError.code === '23505') {
      return { error: '이미 존재하는 아이템 슬러그입니다.' }
    }
    return { error: itemError.message }
  }

  // B. 기존 페이셋 매핑 전부 초기화 후 재생성
  const { error: deleteError } = await supabase
    .from('item_facets')
    .delete()
    .eq('item_id', id)

  if (deleteError) {
    return { error: `페이셋 수정 중 오류가 발생했습니다: ${deleteError.message}` }
  }

  if (formData.facet_ids && formData.facet_ids.length > 0) {
    const itemFacets = formData.facet_ids.map(fId => ({
      item_id: id,
      facet_id: fId
    }))

    const { error: facetError } = await supabase
      .from('item_facets')
      .insert(itemFacets)

    if (facetError) {
      return { error: `아이템 정보는 수정되었으나 페이셋 연결 중 오류가 발생했습니다: ${facetError.message}` }
    }
  }

  revalidatePath('/', 'layout')
  return { success: true, data: item }
}

/* ==========================================
 * 5. RANKING ACTIONS (드래프트 생성 / 일괄 정밀 갱신)
 * ========================================== */

export async function listAdminRankings() {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  const { data, error } = await supabase
    .from('rankings')
    .select('*, categories(name), subcategories(name), ranking_entries(id)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

/**
 * 어드민 랭킹 기본 드래프트 신규 생성
 */
export async function createRankingDraft(formData: {
  category_id: string
  subcategory_id?: string
  title: string
  slug: string
  summary: string
  ranking_type: 'editor_pick' | 'popularity' | 'quality' | 'purpose' | 'user_vote' | 'sponsored'
}) {
  const supabase = await createClient()
  const user = await ensureAdmin(supabase)

  if (!formData.category_id || !formData.title || !formData.slug || !formData.summary) {
    return { error: '카테고리, 제목, 슬러그, 요약 설명은 필수입니다.' }
  }

  // 카테고리 정합성 더블 체크
  if (formData.subcategory_id) {
    const { data: subcat } = await supabase
      .from('subcategories')
      .select('category_id')
      .eq('id', formData.subcategory_id)
      .maybeSingle()

    if (!subcat || subcat.category_id !== formData.category_id) {
      return { error: '선택하신 서브카테고리는 해당 카테고리와 정합성이 일치하지 않습니다.' }
    }
  }

  const { data: ranking, error } = await supabase
    .from('rankings')
    .insert([{
      ...formData,
      status: 'draft',
      featured: false,
      created_by: user.id
    }])
    .select()
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return { error: '이미 존재하는 랭킹 슬러그입니다. 다른 값을 사용해 주세요.' }
    }
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true, data: ranking }
}

/**
 * 랭킹 E2E 일괄 저장 Server Action (정합성 트랜잭션 준용)
 * - rankings 기본정보 수정
 * - ranking_criteria 갱신
 * - ranking_sources 갱신
 * - ranking_entries 갱신 (순위/아이템 중복 검증 필수)
 * - ranking_facets 갱신
 */
export async function saveRankingE2E(
  id: string,
  rankingData: {
    category_id: string
    subcategory_id?: string
    title: string
    slug: string
    summary: string
    body?: string
    ranking_type: string
    scope_json: any
    featured: boolean
    seo_title?: string
    seo_description?: string
    cover_image_url?: string
  },
  criteria: Array<{ id?: string; name: string; description?: string; weight?: number; sort_order: number }>,
  sources: Array<{ id?: string; label: string; url?: string; source_type?: string; note?: string; is_public: boolean }>,
  entries: Array<{ id?: string; item_id: string; position: number; reason: string; editor_score?: number; score_json?: any; internal_note?: string; sponsor_flag: boolean }>,
  facetIds: string[]
) {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  // ==========================================
  // [A] 서버 단 최종 비즈니스 정밀 검증
  // ==========================================

  // 1. 카테고리/서브카테고리 일치 여부 검증
  if (rankingData.subcategory_id) {
    const { data: subcat } = await supabase
      .from('subcategories')
      .select('category_id')
      .eq('id', rankingData.subcategory_id)
      .maybeSingle()

    if (!subcat || subcat.category_id !== rankingData.category_id) {
      return { error: '카테고리와 서브카테고리의 종속 관계가 맞지 않습니다.' }
    }
  }

  // 2. 랭킹 엔트리(순위) 중복 및 0 이하 유효성 검증
  const positions = entries.map(e => Number(e.position))
  const uniquePositions = new Set(positions)
  if (positions.some(pos => pos <= 0 || isNaN(pos))) {
    return { error: '모든 순위는 1 이상의 정수여야 합니다.' }
  }
  if (uniquePositions.size !== positions.length) {
    return { error: '순위표에 중복된 순위가 존재합니다. 고유하게 구성해 주세요.' }
  }

  // 3. 랭킹 엔트리 내 중복 아이템 검증
  const itemIds = entries.map(e => e.item_id)
  const uniqueItemIds = new Set(itemIds)
  if (uniqueItemIds.size !== itemIds.length) {
    return { error: '순위표에 동일한 아이템이 중복 등록되어 있습니다.' }
  }

  try {
    // ==========================================
    // [B] 일괄 업데이트 처리 (부분 저장 실패 최소화)
    // ==========================================

    // 1. Rankings 기본 필드 업데이트
    const { error: rankingError } = await supabase
      .from('rankings')
      .update({
        category_id: rankingData.category_id,
        subcategory_id: rankingData.subcategory_id || null,
        title: rankingData.title,
        slug: rankingData.slug,
        summary: rankingData.summary,
        body: rankingData.body || null,
        ranking_type: rankingData.ranking_type,
        scope_json: rankingData.scope_json || {},
        featured: rankingData.featured,
        seo_title: rankingData.seo_title || null,
        seo_description: rankingData.seo_description || null,
        cover_image_url: rankingData.cover_image_url || null
      })
      .eq('id', id)

    if (rankingError) {
      if (rankingError.code === '23505') {
        return { error: '이미 존재하는 랭킹 슬러그입니다. 다른 슬러그를 사용해 주세요.' }
      }
      return { error: `랭킹 정보 업데이트 실패: ${rankingError.message}` }
    }

    // 2. Criteria (기준) 삭제 및 일괄 재삽입
    const { error: deleteCriteriaError } = await supabase
      .from('ranking_criteria')
      .delete()
      .eq('ranking_id', id)

    if (deleteCriteriaError) throw new Error(`기존 선정기준 초기화 오류: ${deleteCriteriaError.message}`)

    if (criteria.length > 0) {
      const criteriaToInsert = criteria.map(c => ({
        ranking_id: id,
        name: c.name,
        description: c.description || null,
        weight: c.weight || null,
        sort_order: c.sort_order
      }))
      const { error: insertCriteriaError } = await supabase
        .from('ranking_criteria')
        .insert(criteriaToInsert)

      if (insertCriteriaError) throw new Error(`선정기준 업데이트 실패: ${insertCriteriaError.message}`)
    }

    // 3. Sources (출처) 삭제 및 일괄 재삽입
    const { error: deleteSourcesError } = await supabase
      .from('ranking_sources')
      .delete()
      .eq('ranking_id', id)

    if (deleteSourcesError) throw new Error(`기존 출처정보 초기화 오류: ${deleteSourcesError.message}`)

    if (sources.length > 0) {
      const sourcesToInsert = sources.map(s => ({
        ranking_id: id,
        label: s.label,
        url: s.url || null,
        source_type: s.source_type || null,
        note: s.note || null,
        is_public: s.is_public
      }))
      const { error: insertSourcesError } = await supabase
        .from('ranking_sources')
        .insert(sourcesToInsert)

      if (insertSourcesError) throw new Error(`출처정보 업데이트 실패: ${insertSourcesError.message}`)
    }

    // 4. Entries (순위표 항목) 삭제 및 일괄 재삽입
    const { error: deleteEntriesError } = await supabase
      .from('ranking_entries')
      .delete()
      .eq('ranking_id', id)

    if (deleteEntriesError) throw new Error(`기존 순위표 항목 초기화 오류: ${deleteEntriesError.message}`)

    if (entries.length > 0) {
      const entriesToInsert = entries.map(e => ({
        ranking_id: id,
        item_id: e.item_id,
        position: e.position,
        reason: e.reason,
        editor_score: e.editor_score || null,
        score_json: e.score_json || {},
        internal_note: e.internal_note || null,
        sponsor_flag: e.sponsor_flag
      }))
      const { error: insertEntriesError } = await supabase
        .from('ranking_entries')
        .insert(entriesToInsert)

      if (insertEntriesError) throw new Error(`순위표 항목 업데이트 실패: ${insertEntriesError.message}`)
    }

    // 5. Facets (필터 연결) 삭제 및 일괄 재삽입
    const { error: deleteFacetsError } = await supabase
      .from('ranking_facets')
      .delete()
      .eq('ranking_id', id)

    if (deleteFacetsError) throw new Error(`기존 페이셋 연결 초기화 오류: ${deleteFacetsError.message}`)

    if (facetIds.length > 0) {
      const facetsToInsert = facetIds.map(fId => ({
        ranking_id: id,
        facet_id: fId
      }))
      const { error: insertFacetsError } = await supabase
        .from('ranking_facets')
        .insert(facetsToInsert)

      if (insertFacetsError) throw new Error(`페이셋 연결 업데이트 실패: ${insertFacetsError.message}`)
    }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err: any) {
    return { error: `저장 도중 예기치 못한 에러가 발생했습니다: ${err.message}` }
  }
}

/**
 * 랭킹 최종 발행(Publish) 처리
 */
export async function publishRanking(id: string) {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  // 발행 전 필수 필드 데이터 최종 정밀 재검증 (서버 단 검증 강화!)
  const { data: ranking, error: rankingError } = await supabase
    .from('rankings')
    .select('*, ranking_entries(id), ranking_criteria(id)')
    .eq('id', id)
    .maybeSingle()

  if (rankingError || !ranking) {
    return { error: '랭킹 문서를 찾을 수 없습니다.' }
  }

  // 필수 제약 검증
  if (!ranking.title) return { error: '제목이 입력되지 않았습니다.' }
  if (!ranking.category_id) return { error: '카테고리가 매핑되지 않았습니다.' }
  if (!ranking.summary) return { error: '요약 설명이 필요합니다.' }
  if (!ranking.ranking_type) return { error: '랭킹 종류 유형 선택이 누락되었습니다.' }
  if (!ranking.scope_json || Object.keys(ranking.scope_json).length === 0) {
    return { error: '후보군 범위(Scope) 정보가 누락되었습니다.' }
  }
  if (!ranking.ranking_entries || ranking.ranking_entries.length < 1) {
    return { error: '랭킹 순위표에 아이템이 최소 1개 이상 연결되어야 발행 가능합니다.' }
  }
  if (!ranking.ranking_criteria || ranking.ranking_criteria.length < 1) {
    return { error: '순위표 선정 기준(Criteria)이 최소 1개 이상 등록되어야 발행 가능합니다.' }
  }

  // 상태 변경
  const { error: updateError } = await supabase
    .from('rankings')
    .update({
      status: 'published',
      published_at: new Date().toISOString()
    })
    .eq('id', id)

  if (updateError) {
    return { error: `발행 도중 에러가 발생했습니다: ${updateError.message}` }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

/**
 * 랭킹 발행 취소(Unpublish) 처리 (드래프트 복원)
 */
export async function unpublishRanking(id: string) {
  const supabase = await createClient()
  await ensureAdmin(supabase)

  const { error } = await supabase
    .from('rankings')
    .update({
      status: 'draft',
      published_at: null
    })
    .eq('id', id)

  if (error) {
    return { error: `발행 취소 도중 에러가 발생했습니다: ${error.message}` }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
