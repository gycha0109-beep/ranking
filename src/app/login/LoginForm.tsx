'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, signUp } from '@/lib/actions/auth'
import { Shield, Mail, Lock, User, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'

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
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[450px] h-[450px] bg-indigo-600/20 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 mb-4 shadow-inner shadow-indigo-500/5">
            <Shield className="w-8 h-8 text-indigo-400 animate-pulse" />
          </div>
          <h1 className="text-3xl