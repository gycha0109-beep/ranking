import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/public'

export const SITE_NAME = '랭킹위키'
export const SITE_DESCRIPTION = '다양한 주제의 순위와 선정 기준, 이유를 투명하게 공개하는 위키형 랭킹 아카이브'
const PUBLIC_MODERATION_STATUSES = ['clean', 'suggestive']

function normalizeOrigin(raw: string) {
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  const url = new URL(candidate)
  return url.origin
}

export function getSiteOrigin() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) {
    try {
      return normalizeOrigin(explicit)
    } catch {
      // Fall through to deployment/local defaults.
    }
  }

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercel) {
    try {
      return normalizeOrigin(vercel)
    } catch {
      // Fall through to local default.
    }
  }

  return 'http://localhost:3000'
}

export function absoluteUrl(path: string) {
  return new URL(path, `${getSiteOrigin()}/`).toString()
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function one(value: any) {
  return Array.isArray(value) ? value[0] || null : value || null
}

export const getCategorySeoSnapshot = cache(async (slug: string) => {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, slug, description, created_at, updated_at')
    .eq('slug', slug)
    .eq('is_visible', true)
    .maybeSingle()
  return (data as any) || null
})

export const getSubcategorySeoSnapshot = cache(async (categorySlug: string, subcategorySlug: string) => {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('subcategories')
    .select('id, name, slug, description, created_at, updated_at, categories!inner(name, slug, is_visible)')
    .eq('slug', subcategorySlug)
    .eq('is_visible', true)
    .eq('categories.slug', categorySlug)
    .eq('categories.is_visible', true)
    .maybeSingle()

  if (!data) return null
  const row = data as any
  return { ...row, category: one(row.categories) }
})

export const getRankingSeoSnapshot = cache(async (slug: string) => {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('rankings')
    .select('id, title, slug, summary, seo_title, seo_description, cover_image_url, published_at, created_at, updated_at, categories(name, slug), subcategories(name, slug)')
    .eq('slug', slug)
    .eq('status', 'published')
    .in('moderation_status', PUBLIC_MODERATION_STATUSES)
    .in('image_moderation_status', PUBLIC_MODERATION_STATUSES)
    .maybeSingle()

  if (!data) return null
  const ranking = data as any
  const { data: entries } = await supabase
    .from('ranking_entries')
    .select('position, reason, items!inner(id, title, slug, status, moderation_status, image_moderation_status)')
    .eq('ranking_id', ranking.id)
    .in('moderation_status', PUBLIC_MODERATION_STATUSES)
    .eq('items.status', 'active')
    .in('items.moderation_status', PUBLIC_MODERATION_STATUSES)
    .in('items.image_moderation_status', PUBLIC_MODERATION_STATUSES)
    .order('position', { ascending: true })

  return {
    ...ranking,
    category: one(ranking.categories),
    subcategory: one(ranking.subcategories),
    entries: (entries || []).map((entry: any) => ({
      position: entry.position,
      reason: entry.reason,
      item: one(entry.items),
    })).filter((entry: any) => entry.item),
  }
})

export const getItemSeoSnapshot = cache(async (slug: string) => {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('items')
    .select('id, title, slug, description, image_url, brand_or_creator, item_type, created_at, updated_at')
    .eq('slug', slug)
    .eq('status', 'active')
    .in('moderation_status', PUBLIC_MODERATION_STATUSES)
    .in('image_moderation_status', PUBLIC_MODERATION_STATUSES)
    .maybeSingle()
  return (data as any) || null
})

export async function getPublicSitemapRows() {
  const supabase = createPublicClient()
  const [categories, subcategories, rankings, items] = await Promise.all([
    supabase
      .from('categories')
      .select('slug, created_at, updated_at')
      .eq('is_visible', true),
    supabase
      .from('subcategories')
      .select('slug, created_at, updated_at, categories!inner(slug, is_visible)')
      .eq('is_visible', true)
      .eq('categories.is_visible', true),
    supabase
      .from('rankings')
      .select('slug, published_at, updated_at')
      .eq('status', 'published')
      .in('moderation_status', PUBLIC_MODERATION_STATUSES)
      .in('image_moderation_status', PUBLIC_MODERATION_STATUSES),
    supabase
      .from('items')
      .select('slug, created_at, updated_at')
      .eq('status', 'active')
      .in('moderation_status', PUBLIC_MODERATION_STATUSES)
      .in('image_moderation_status', PUBLIC_MODERATION_STATUSES),
  ])

  return {
    categories: (categories.data || []) as any[],
    subcategories: (subcategories.data || []).map((row: any) => ({ ...row, category: one(row.categories) })).filter((row: any) => row.category),
    rankings: (rankings.data || []) as any[],
    items: (items.data || []) as any[],
  }
}
