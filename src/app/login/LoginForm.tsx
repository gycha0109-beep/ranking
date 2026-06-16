'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, signUp } from '@/lib/actions/auth'
import { Shield, Mail, Lock, User, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') || '/'
  const errorParam = searchParams.get('error')

  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(
    errorParam === 'not_authorized' ? '어드민 권한이 필요한 페이지입니다.' : null
  )
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsPending(true)

    try {
      const formData = new FormData()
      formData.append('email', email)
      formData.append('password', password)
      
      if (isLogin) {
        const res = await signIn(formData)
        if (!res.ok) {
          setErrorMessage(res.error || '로그인에 실패했습니다.')
        } else {
          router.push(nextPath)
          router.refresh()
        }
      } else {
        formData.append('displayName', displayName)
        const res = await signUp(formData)
        if (!res.ok) {
          setErrorMessage(res.error || '회원가입에 실패했습니다.')
        } else {
          setSuccessMessage(res.message || '회원가입이 완료되었습니다!')
          setIsLogin(true)
          setPassword('')
        }
      }
    } catch (err: any) {
      console.error('Submit error:', err)
      setErrorMessage(err.message || '요청 처리 중 오류가 발생했습니다.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#0a0a0c] text-slate-100 overflow-hidden font-sans">
      {/* 백그라운드 오로라 그라데이션 이펙트 */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[450px] h-[450px] bg-indigo-600/20 rounded-full blur-[150px] pointer-events-none" />
      
      {/* 컨테이너 */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* 로고 / 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 mb-4 shadow-inner shadow-indigo-500/5">
            <Shield className="w-8 h-8 text-indigo-400 animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-indigo-200">
            랭킹위키 MVP
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {isLogin ? '어드민 권한으로 대시보드에 접근합니다.' : '신규 에디터 계정을 등록합니다.'}
          </p>
        </div>

        {/* 글래스모피즘 카드 */}
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
          
          {/* 에러 피드백 */}
          {errorMessage && (
            <div className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm mb-6 animate-fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 성공 피드백 */}
          {successMessage && (
            <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300 text-sm mb-6 animate-fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 이름 입력 (회원가입인 경우만) */}
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">이름 / 닉네임</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="홍길동"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-white/5 rounded-2xl focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder-slate-600 text-sm"
                  />
                </div>
              </div>
            )}

            {/* 이메일 */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">이메일 주소</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="admin@rankingwiki.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-white/5 rounded-2xl focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder-slate-600 text-sm"
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-white/5 rounded-2xl focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder-slate-600 text-sm"
                />
              </div>
            </div>

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={isPending}
              className="relative w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:pointer-events-none rounded-2xl font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-2 text-white group mt-6"
            >
              {isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? '로그인 완료' : '회원가입 완료'}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* 모드 전환 */}
          <div className="mt-6 text-center text-xs text-slate-400">
            {isLogin ? (
              <span>
                처음이신가요?{' '}
                <button
                  onClick={() => {
                    setIsLogin(false)
                    setErrorMessage(null)
                  }}
                  className="text-indigo-400 font-semibold hover:underline bg-transparent border-none outline-none cursor-pointer"
                >
                  새 에디터 가입
                </button>
              </span>
            ) : (
              <span>
                이미 계정이 있으신가요?{' '}
                <button
                  onClick={() => {
                    setIsLogin(true)
                    setErrorMessage(null)
                  }}
                  className="text-indigo-400 font-semibold hover:underline bg-transparent border-none outline-none cursor-pointer"
                >
                  로그인 화면으로
                </button>
              </span>
            )}
          </div>
        </div>

        {/* 첫 어드민 팁 박스 */}
        {isLogin && (
          <div className="mt-8 backdrop-blur-md bg-white/[0.01] border border-white/5 p-5 rounded-2xl text-xs text-slate-400 flex flex-col gap-2">
            <span className="font-semibold text-indigo-300">💡 로컬/개발 환경 팁:</span>
            <p className="leading-relaxed">
              `.env.local` 에 `ADMIN_BOOTSTRAP_EMAIL` 을 추가하고, 해당 메일로 로그인(혹은 신규 가입 후 로그인)하면 RLS 우회 트리거를 통해 자동으로 **admin** 권한이 부여됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
