'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * 로그인 액션
 */
export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: '이메일과 비밀번호를 입력해주세요.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  const user = data.user
  if (user) {
    // 개발 환경 한정 ADMIN_BOOTSTRAP_EMAIL 자동 승격
    const isDev = process.env.NODE_ENV === 'development'
    const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL

    if (isDev && bootstrapEmail && user.email === bootstrapEmail) {
      try {
        const adminSupabase = createAdminClient()
        
        // profiles가 트리거에 의해 생성되는 것을 보장하기 위해 profiles 조회/upsert를 시도할 수도 있음
        // user_roles에 admin 삽입
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

  revalidatePath('/', 'layout')
  return { success: true }
}

/**
 * 회원가입 액션 (P0-Core 부가 기능)
 */
export async function signUp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const displayName = formData.get('displayName') as string

  if (!email || !password || !displayName) {
    return { error: '모든 필수 항목을 기입해 주세요.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true, message: '회원가입이 완료되었습니다. 이메일 인증이 필요한 경우 이메일을 확인해주세요.' }
}

/**
 * 로그아웃 액션
 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  return { success: true }
}
