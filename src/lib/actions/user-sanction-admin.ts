'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')
  const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
  if (!role) throw new Error('관리자 권한이 없습니다.')
  return supabase
}

export async function loadUserSanctionAdminData() {
  try {
    const supabase = await requireAdmin()
    const [sanctions, appeals] = await Promise.all([
      supabase.rpc('list_recent_user_sanctions', { p_limit: 100, p_offset: 0 }),
      supabase.rpc('list_pending_user_sanction_appeals', { p_limit: 100, p_offset: 0 }),
    ])
    if (sanctions.error) throw new Error(sanctions.error.message)
    if (appeals.error) throw new Error(appeals.error.message)
    return { sanctions: Array.isArray(sanctions.data) ? sanctions.data : [], appeals: Array.isArray(appeals.data) ? appeals.data : [] }
  } catch (error) {
    return { sanctions: [], appeals: [], error: error instanceof Error ? error.message : '제재 운영 데이터를 불러오지 못했습니다.' }
  }
}

export async function imposeUserSanction(formData: FormData) {
  const supabase = await requireAdmin()
  const type = String(formData.get('sanctionType') || '')
  const durationRaw = String(formData.get('durationHours') || '')
  const duration = type === 'warning' ? null : Number(durationRaw)
  const { error } = await supabase.rpc('admin_impose_user_sanction', {
    p_target_user_id: String(formData.get('targetUserId') || ''),
    p_sanction_type: type,
    p_reason: String(formData.get('reason') || ''),
    p_admin_note: String(formData.get('adminNote') || '').normalize('NFKC').trim().replace(/\s+/gu, ' '),
    p_duration_hours: duration,
    p_source_comment_id: null,
    p_source_report_decision_id: null,
    p_source_moderation_review_id: null,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/user-sanctions')
  revalidatePath('/me/sanctions')
}

export async function revokeUserSanction(formData: FormData) {
  const supabase = await requireAdmin()
  const { error } = await supabase.rpc('admin_revoke_user_sanction', {
    p_sanction_id: String(formData.get('sanctionId') || ''),
    p_note: String(formData.get('note') || '').normalize('NFKC').trim().replace(/\s+/gu, ' '),
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/user-sanctions')
  revalidatePath('/me/sanctions')
}

export async function reviewUserSanctionAppeal(formData: FormData) {
  const supabase = await requireAdmin()
  const { error } = await supabase.rpc('review_user_sanction_appeal', {
    p_appeal_id: String(formData.get('appealId') || ''),
    p_decision: String(formData.get('decision') || ''),
    p_review_note: String(formData.get('reviewNote') || '').normalize('NFKC').trim().replace(/\s+/gu, ' '),
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/user-sanctions')
  revalidatePath('/me/sanctions')
  revalidatePath('/', 'layout')
}
