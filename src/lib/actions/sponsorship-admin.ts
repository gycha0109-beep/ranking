'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminCapability, runAdminRpc } from '@/lib/actions/admin-access'

export type SponsorRow = {
  id: string
  name: string
  slug: string
  website_url: string | null
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
}

export type SponsorshipRow = {
  id: string
  sponsor_id: string
  sponsor_name: string
  target_type: 'ranking' | 'item' | 'placement'
  ranking_id: string | null
  ranking_title: string | null
  item_id: string | null
  item_title: string | null
  relationship_type: string
  disclosure_text: string
  influence_scope: string
  influence_note: string | null
  starts_at: string
  ends_at: string | null
  status: 'draft' | 'published' | 'archived'
  published_at: string | null
  internal_note: string | null
  created_at: string
  updated_at: string
  period_state: 'upcoming' | 'current' | 'historical'
}

export type SponsorshipEventRow = {
  id: string
  actor_id: string | null
  actor_label: string
  entity_type: 'sponsor' | 'sponsorship'
  entity_id: string
  action: string
  reason: string
  before_data: Record<string, unknown>
  after_data: Record<string, unknown>
  created_at: string
}

export type SponsorshipOption = { id: string; title: string; slug: string }

export type SponsorshipReadiness = {
  unresolvedLegacyFlags: number
  legacyReconcileEvents: number
  publishedSponsorships: number
  normalizedAuthorityReady: boolean
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim()
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key)
  return value || null
}

function nullableUuid(formData: FormData, key: string) {
  const value = text(formData, key)
  return value || null
}

function redirectResult(path: string, message: string, isError = false): never {
  const params = new URLSearchParams()
  params.set(isError ? 'error' : 'ok', message)
  redirect(`${path}?${params.toString()}`)
}

function adminSubjectType(rpcName: string) {
  return ['admin_create_sponsor', 'admin_update_sponsor', 'admin_archive_sponsor'].includes(rpcName)
    ? 'sponsor'
    : 'sponsorship'
}

function normalizeSponsorshipPeriod(row: Omit<SponsorshipRow, 'period_state'>): SponsorshipRow['period_state'] {
  const now = Date.now()
  const startsAt = new Date(row.starts_at).getTime()
  const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : null
  if (startsAt > now) return 'upcoming'
  if (endsAt !== null && endsAt <= now) return 'historical'
  return 'current'
}

async function mutation(
  rpcName: string,
  args: Record<string, unknown>,
  path: string,
  successMessage: string,
  subjectRef?: string | null,
) {
  const result = await runAdminRpc('sponsorship_manage', rpcName, args, {
    actionKey: rpcName,
    resourceKey: 'sponsorship_management',
    routeKey: path,
    subjectType: adminSubjectType(rpcName),
    subjectRef,
  })
  if (result.error) redirectResult(path, result.error.message, true)
  revalidatePath('/admin')
  revalidatePath('/admin/sponsors')
  revalidatePath('/admin/sponsorships')
  revalidatePath('/', 'layout')
  redirectResult(path, successMessage)
}

export async function listSponsors(): Promise<SponsorRow[]> {
  const supabase = await requireAdminCapability('sponsorship_manage', {
    actionKey: 'admin_list_sponsors', resourceKey: 'sponsorship_management', routeKey: '/admin/sponsors',
  })
  const { data, error } = await supabase.rpc('admin_list_sponsors')
  if (error) throw new Error(error.message)
  return (data || []) as SponsorRow[]
}

export async function listSponsorships(): Promise<SponsorshipRow[]> {
  const supabase = await requireAdminCapability('sponsorship_manage', {
    actionKey: 'admin_list_sponsorships', resourceKey: 'sponsorship_management', routeKey: '/admin/sponsorships',
  })
  const { data, error } = await supabase.rpc('admin_list_sponsorships')
  if (error) throw new Error(error.message)
  const rows = (data || []) as Array<Omit<SponsorshipRow, 'period_state'>>
  return rows.map((row) => ({ ...row, period_state: normalizeSponsorshipPeriod(row) }))
}

export async function listSponsorshipEvents(limit = 50): Promise<SponsorshipEventRow[]> {
  const supabase = await requireAdminCapability('audit_view', {
    actionKey: 'admin_list_sponsorship_events', resourceKey: 'audit', routeKey: '/admin/sponsorships',
  })
  const { data, error } = await supabase.rpc('admin_list_sponsorship_events', { p_limit: limit })
  if (error) throw new Error(error.message)
  return (data || []) as SponsorshipEventRow[]
}

export async function getSponsorshipReadiness(): Promise<SponsorshipReadiness> {
  const supabase = await requireAdminCapability('sponsorship_manage', {
    actionKey: 'admin_get_sponsorship_readiness', resourceKey: 'sponsorship_management', routeKey: '/admin/sponsorships',
  })
  const { data, error } = await supabase.rpc('admin_get_sponsorship_readiness')
  if (error) throw new Error(error.message)
  const value = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {}
  return {
    unresolvedLegacyFlags: Number(value.unresolved_legacy_flags || 0),
    legacyReconcileEvents: Number(value.legacy_reconcile_events || 0),
    publishedSponsorships: Number(value.published_sponsorships || 0),
    normalizedAuthorityReady: value.normalized_authority_ready === true,
  }
}

export async function getSponsorshipOptions() {
  const supabase = await requireAdminCapability('sponsorship_manage', {
    actionKey: 'list_sponsorship_options', resourceKey: 'sponsorship_management', routeKey: '/admin/sponsorships',
  })
  const [{ data: rankings, error: rankingError }, { data: items, error: itemError }] = await Promise.all([
    supabase.from('rankings').select('id,title,slug').order('title'),
    supabase.from('items').select('id,title,slug').order('title'),
  ])
  if (rankingError) throw new Error(rankingError.message)
  if (itemError) throw new Error(itemError.message)
  return {
    rankings: (rankings || []) as SponsorshipOption[],
    items: (items || []) as SponsorshipOption[],
  }
}

export async function createSponsorAction(formData: FormData) {
  return mutation('admin_create_sponsor', {
    p_name: text(formData, 'name'),
    p_slug: text(formData, 'slug'),
    p_website_url: nullableText(formData, 'website_url'),
    p_reason: text(formData, 'reason'),
  }, '/admin/sponsors', '협찬 주체를 생성했습니다.')
}

export async function updateSponsorAction(formData: FormData) {
  const id = text(formData, 'id')
  return mutation('admin_update_sponsor', {
    p_id: id,
    p_name: text(formData, 'name'),
    p_slug: text(formData, 'slug'),
    p_website_url: nullableText(formData, 'website_url'),
    p_reason: text(formData, 'reason'),
  }, '/admin/sponsors', '협찬 주체를 수정했습니다.', id)
}

export async function archiveSponsorAction(formData: FormData) {
  const id = text(formData, 'id')
  return mutation('admin_archive_sponsor', { p_id: id, p_reason: text(formData, 'reason') }, '/admin/sponsors', '협찬 주체를 보관 처리했습니다.', id)
}

function sponsorshipArgs(formData: FormData) {
  const targetType = text(formData, 'target_type')
  return {
    p_sponsor_id: text(formData, 'sponsor_id'),
    p_target_type: targetType,
    p_ranking_id: targetType === 'item' ? null : nullableUuid(formData, 'ranking_id'),
    p_item_id: targetType === 'ranking' ? null : nullableUuid(formData, 'item_id'),
    p_relationship_type: text(formData, 'relationship_type'),
    p_disclosure_text: text(formData, 'disclosure_text'),
    p_influence_scope: text(formData, 'influence_scope'),
    p_influence_note: nullableText(formData, 'influence_note'),
    p_starts_at: text(formData, 'starts_at'),
    p_ends_at: nullableText(formData, 'ends_at'),
    p_internal_note: nullableText(formData, 'internal_note'),
    p_reason: text(formData, 'reason'),
  }
}

export async function createSponsorshipAction(formData: FormData) {
  return mutation('admin_create_sponsorship', sponsorshipArgs(formData), '/admin/sponsorships', '협찬 관계 초안을 생성했습니다.')
}

export async function updateSponsorshipAction(formData: FormData) {
  const id = text(formData, 'id')
  return mutation('admin_update_sponsorship', { p_id: id, ...sponsorshipArgs(formData) }, '/admin/sponsorships', '협찬 관계 초안을 수정했습니다.', id)
}

export async function publishSponsorshipAction(formData: FormData) {
  const id = text(formData, 'id')
  return mutation('admin_publish_sponsorship', { p_id: id, p_reason: text(formData, 'reason') }, '/admin/sponsorships', '협찬 관계를 공개했습니다.', id)
}

export async function archiveSponsorshipAction(formData: FormData) {
  const id = text(formData, 'id')
  return mutation('admin_archive_sponsorship', { p_id: id, p_reason: text(formData, 'reason') }, '/admin/sponsorships', '협찬 관계를 보관 처리했습니다.', id)
}
