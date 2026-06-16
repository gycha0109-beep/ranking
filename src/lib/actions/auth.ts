'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * 개발 환경에서 특정 이메일이 로그인 또는 회원가입할 때 admin 역할을 부여하는 헬퍼 함수
 */
export async function ensureBootstrapAdminRole(user: any) {
  if (!user || !user.email) return

  const isDev = process.env.NODE_ENV === 'development'
  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!isDev) return

  // SUPABASE_SERVICE_ROLE_KEY가 없으면 bootstrap만 skip하고 로그 남김
  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY가 없습니다. 어드민 부트스트랩을 건너뜁니다.')
    return
  }

  const cleanUserEmail = user.email.trim().toLowerCase()
  const cleanBootstrapEmail = bootstrapEmail ? bootstrapEmail.trim().toLowerCase() : ''

  if (cleanBootstrapEmail && cleanUserEmail === cleanBootstrapEmail) {
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
      } else {
        console.log(`Successfully bootstrapped ${user.email} as admin`)
      }
    } catch (err: any) {
      console.error('Error during admin bootstrap:', err.message)
    }
  }
}

/**
 * 로그인 액션
 */
export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { ok: false, error: '이메일과 비밀번호를 입력해주세요.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  const user = data.user
  if (user) {
    await ensureBootstrapAdminRole(user)
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}

/**
 * 회원가입 액션 (P0-Core 부가 기능)
 */
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

  const user = data?.user
  if (user) {
    await ensureBootstrapAdminRole(user)
  }

  return { ok: true, message: '회원가입이 완료되었습니다. 이메일 인증이 필요한 경우 이메일을 확인해주세요.' }
}

/**
 * 로그아웃 액션
 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  return { ok: true }
}
