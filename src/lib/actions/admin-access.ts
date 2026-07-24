'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type AdminRoleLevel = 'none' | 'moderator' | 'admin' | 'super_admin'

export type AdminAccess = {
  roleLevel: AdminRoleLevel
  capabilities: string[]
}

export async function getMyAdminAccess(): Promise<AdminAccess> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { roleLevel: 'none', capabilities: [] }

  const { data, error } = await supabase.rpc('get_my_admin_access')
  if (error || !data || typeof data !== 'object') return { roleLevel: 'none', capabilities: [] }

  const value = data as { role_level?: unknown; capabilities?: unknown }
  const roleLevel = ['moderator', 'admin', 'super_admin'].includes(String(value.role_level))
    ? String(value.role_level) as AdminRoleLevel
    : 'none'
  const capabilities = Array.isArray(value.capabilities)
    ? value.capabilities.filter((item): item is string => typeof item === 'string')
    : []

  return { roleLevel, capabilities }
}

export async function requireAdminCapability(capability: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase.rpc('has_admin_capability', { p_capability: capability })
  if (error || data !== true) throw new Error('이 운영 작업을 수행할 권한이 없습니다.')
  return supabase
}

export async function searchAdminRoleCandidates(query: string) {
  try {
    const supabase = await requireAdminCapability('role_manage')
    const normalized = query.normalize('NFKC').trim()
    if (normalized.length < 2) return { data: [], error: '검색어는 2자 이상 입력해 주세요.' }
    const { data, error } = await supabase.rpc('search_admin_role_candidates', {
      p_query: normalized,
      p_limit: 30,
    })
    if (error) return { data: [], error: error.message }
    return { data: Array.isArray(data) ? data : [] }
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : '사용자를 검색하지 못했습니다.' }
  }
}

export async function listAdminRoleChangeEvents() {
  try {
    const supabase = await requireAdminCapability('audit_view')
    const { data, error } = await supabase.rpc('list_admin_role_change_events', { p_limit: 100, p_offset: 0 })
    if (error) return { data: [], error: error.message }
    return { data: Array.isArray(data) ? data : [] }
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : '역할 변경 이력을 불러오지 못했습니다.' }
  }
}

export async function setAdminRoleLevel(formData: FormData) {
  const supabase = await requireAdminCapability('role_manage')
  const targetUserId = String(formData.get('targetUserId') || '')
  const newLevel = String(formData.get('newLevel') || '')
  const reason = String(formData.get('reason') || '').normalize('NFKC').trim().replace(/\s+/gu, ' ')
  const { error } = await supabase.rpc('set_admin_role_level', {
    p_target_user_id: targetUserId,
    p_new_level: newLevel,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/access-control')
  revalidatePath('/admin')
  revalidatePath('/', 'layout')
}

export async function listAdminAuditEvents() {
  try {
    const supabase = await requireAdminCapability('audit_view')
    const { data, error } = await supabase.rpc('list_admin_audit_events', { p_limit: 150, p_offset: 0 })
    if (error) return { data: [], error: error.message }
    return { data: Array.isArray(data) ? data : [] }
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : '운영 감사 기록을 불러오지 못했습니다.' }
  }
}
