import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ next?: string | string[] }>
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams
  const nextPath = Array.isArray(params.next) ? params.next[0] : params.next

  if (nextPath && (!nextPath.startsWith('/') || nextPath.startsWith('//'))) {
    redirect('/login')
  }

  return (
    <Suspense fallback={
      <div className="rw-page flex min-h-screen items-center justify-center px-4 text-sm font-semibold text-slate-600">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          <span>계정 화면을 불러오는 중입니다.</span>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
