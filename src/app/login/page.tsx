import React, { Suspense } from 'react'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c] text-slate-400 text-xs font-bold font-sans">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <span>보안 인증 센터 로드 중...</span>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
