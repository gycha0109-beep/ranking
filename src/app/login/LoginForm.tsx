'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, signUp } from '@/lib/actions/auth'
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Lock, Mail, User } from 'lucide-react'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawNextPath = searchParams.get('next')
  const nextPath = rawNextPath?.startsWith('/') && !rawNextPath.startsWith('//')
    ? rawNextPath
    : '/'
  const errorParam = searchParams.get('error')

  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(
    errorParam === 'not_authorized' ? '이 페이지에 접근할 권한이 없습니다.' : null
  )
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsPending(true)

    try {
      const formData = new FormData()
      formData.append('email', email)
      formData.append('password', password)

      if (isLogin) {
        const result = await signIn(formData)
        if (!result.ok) {
          setErrorMessage(result.error || '로그인에 실패했습니다.')
        } else {
          router.push(nextPath)
          router.refresh()
        }
      } else {
        formData.append('displayName', displayName)
        const result = await signUp(formData)
        if (!result.ok) {
          setErrorMessage(result.error || '회원가입에 실패했습니다.')
        } else {
          setSuccessMessage(result.message || '회원가입이 완료되었습니다.')
          setIsLogin(true)
          setPassword('')
        }
      }
    } catch (error: unknown) {
      console.error('Submit error:', error)
      setErrorMessage(error instanceof Error ? error.message : '요청 처리 중 오류가 발생했습니다.')
    } finally {
      setIsPending(false)
    }
  }

  const switchMode = (login: boolean) => {
    setIsLogin(login)
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  return (
    <main className="rw-page flex min-h-screen items-center justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          랭킹위키로 돌아가기
        </Link>

        <section className="rw-surface rw-card p-6 sm:p-8" aria-labelledby="account-title">
          <p className="rw-kicker">ACCOUNT</p>
          <h1 id="account-title" className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            {isLogin ? '로그인' : '회원가입'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {isLogin
              ? '로그인하면 투표, 좋아요, 북마크, 댓글 등 참여 기능을 사용할 수 있습니다.'
              : '랭킹위키 계정을 만들고 공개 랭킹에 참여해 보세요.'}
          </p>

          {errorMessage && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            {!isLogin && (
              <div>
                <label htmlFor="display-name" className="mb-2 block text-sm font-bold text-slate-800">
                  이름 또는 닉네임
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="display-name"
                    type="text"
                    required
                    autoComplete="nickname"
                    placeholder="표시할 이름"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-bold text-slate-800">
                이메일
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-bold text-slate-800">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  placeholder="비밀번호 입력"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="rw-button-primary w-full px-4 py-3 disabled:pointer-events-none disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? '로그인' : '회원가입'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
            {isLogin ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}{' '}
            <button
              type="button"
              onClick={() => switchMode(!isLogin)}
              className="font-bold text-indigo-700 hover:text-indigo-900 hover:underline"
            >
              {isLogin ? '회원가입' : '로그인'}
            </button>
          </div>
        </section>

        <p className="rw-muted mt-5 text-center text-xs leading-5">
          계정 기능은 공개 콘텐츠 열람과 별개이며, 로그인하지 않아도 공개 랭킹을 탐색할 수 있습니다.
        </p>
      </div>
    </main>
  )
}
