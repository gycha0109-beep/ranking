'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type UserSanction = {
  id: string
  type: string
  reason: string
  startsAt: string
  endsAt: string | null
  createdAt: string
  state: string
  sourceType: string
  appeal: null | {
    id: string
    statement: string
    createdAt: string
    decision: string | null
    decidedAt: string | null
  }
  canAppeal: boolean
}

export async function listMyUserSanctions(): Promise<{ data: UserSanction[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: '로그인이 필요합니다.' }

  const { data, error } = await supabase.rpc('list_my_user_sanctions', { p_limit: 100, p_offset: 0 })
  if (error) return { data: [], error: error.message }

  return {
    data: (Array.isArray(data) ? data : []).map((raw) => {
      const row = raw as Record<string, unknown>
      const appealId = typeof row.appeal_id === 'string' ? row.appeal_id : null
      return {
        id: String(row.sanction_id),
        type: String(row.sanction_type),
        reason: String(row.reason),
        startsAt: String(row.starts_at),
        endsAt: typeof row.ends_at === 'string' ? row.ends_at : null,
        createdAt: String(row.created_at),
        state: String(row.effective_state),
        sourceType: String(row.source_type),
        appeal: appealId ? {
          id: appealId,
          statement: String(row.appeal_statement || ''),
          createdAt: String(row.appeal_created_at),
          decision: typeof row.appeal_decision === 'string' ? row.appeal_decision : null,
          decidedAt: typeof row.appeal_decided_at === 'string' ? row.appeal_decided_at : null,
        } : null,
        canAppeal: row.can_appeal === true,
      }
    }),
  }
}

export async function submitUserSanctionAppeal(formData: FormData) {
  const sanctionId = String(formData.get('sanctionId') || '')
  const statement = String(formData.get('statement') || '').normalize('NFKC').trim().replace(/\s+/gu, ' ')
  if (!sanctionId || statement.length < 20 || statement.length > 2000) {
    return { error: '이의제기 내용은 20자 이상 2,000자 이하로 입력해 주세요.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { error } = await supabase.rpc('submit_user_sanction_appeal', {
    p_sanction_id: sanctionId,
    p_statement: statement,
  })
  if (error) return { error: error.message }
  revalidatePath('/me/sanctions')
  revalidatePath('/admin/user-sanctions')
  return { success: true }
}
