'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * 개발 환경에서 현재 세션 사용자가 지정 이메일과 일치할 때만 admin 역할을 부여한다.
 * 외부 호출 가능한 Server Action으로 노출하지 않으며, 전달받은 사용자 객체를 신뢰하지 않는다.
 */
async function ensureBootstrapAdminRole() {
  if (process.env.NODE_ENV !== 'development') return

  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!bootstrapEmail) return

  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY가 없습니다. 어드민 부트스트랩을 건너뜁니다.')
    return
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user?.email) return
  if (user.email.trim().toLowerCase() !== bootstrapEmail) return

  try {
    const adminSupabase = createAdminClient()
    const { error: roleError } = await adminSupabase
      .from('user_roles')
      .upsert(
        { user_id: user.id, role: 'admin' },
        { onConflict: 'user_id,role' }
      )

    if (roleError) {
      console.error('Admin bootstrap failed:', roleError.message)
    }
  } catch (error) {
    console.error('Error during admin bootstrap:', error instanceof Error ? error.message : 'Unknown error')
  }
}

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { ok: false, error: '이메일과 비밀번호를 입력해주세요.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { ok: false, error: error.message }
  }

  await ensureBootstrapAdminRole()

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const displayName = formData.get('displayName') as string

  if (!email || !password || !displayName) {
    return { ok: false, error: '모든 필수 항목을 기입해 주세요.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  if (data.session) {
    await ensureBootstrapAdminRole()
  }

  return { ok: true, message: '회원가입이 완료되었습니다. 이메일 인증이 필요한 경우 이메일을 확인해주세요.' }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  return { ok: true }
}
