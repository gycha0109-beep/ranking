'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { ok: false, error: error.message }
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
    return { ok: false, error: error.message }
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
