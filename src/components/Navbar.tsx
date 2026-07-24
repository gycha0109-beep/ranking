import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/actions/auth'
import { Bell, Bookmark, Shield, Scale, LogIn, LogOut, LayoutDashboard, Compass } from 'lucide-react'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  let unreadNotificationCount = 0

  if (user) {
    const [roleResult, notificationResult] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle(),
      supabase.rpc('get_my_unread_notification_count'),
    ])
    isAdmin = Boolean(roleResult.data)
    if (!notificationResult.error) {
      const parsed = Number(notificationResult.data)
      unreadNotificationCount = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
    }
  }

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#07070a]/75 border-b border-white/[0.06] shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-2 rounded-xl bg-indigo-600/10 border border-indigo-500/20 group-hover:bg-indigo-600/20 group-hover:border-indigo-500/35 transition-all">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-200 group-hover:to-indigo-200 transition-all">랭킹위키</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            <Link href="/categories" className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-all flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />카테고리 탐색
            </Link>
            {user && (
              <>
                <Link href="/me/bookmarks" className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-all flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5" />내 북마크
                </Link>
                <Link href="/me/sanctions" className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-all flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5" />제재·이의제기
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link href="/me/notifications" className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-400 transition hover:border-indigo-500/25 hover:bg-indigo-500/10 hover:text-indigo-200" title="내 알림" aria-label={`내 알림${unreadNotificationCount > 0 ? `, 읽지 않음 ${unreadNotificationCount}개` : ''}`}>
                <Bell className="h-4 w-4" />
                {unreadNotificationCount > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full border-2 border-[#07070a] bg-indigo-400 px-1 text-center text-[8px] font-black leading-4 text-indigo-950">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}
              </Link>
              {isAdmin && (
                <Link href="/admin" className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600/10 hover:bg-indigo-600/25 border border-indigo-500/20 hover:border-indigo-500/35 text-indigo-300 transition-all flex items-center gap-1.5">
                  <LayoutDashboard className="w-3.5 h-3.5" />관리자 CMS
                </Link>
              )}
              <span className="hidden md:inline text-xs font-semibold text-slate-400 bg-white/[0.02] border border-white/5 px-3 py-1.5 rounded-xl">{user.email}</span>
              <form action={async () => { 'use server'; await signOut() }}>
                <button type="submit" className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/10 transition-all flex items-center justify-center" title="로그아웃"><LogOut className="w-4 h-4" /></button>
              </form>
            </>
          ) : (
            <Link href="/login" className="px-4 py-2 rounded-xl text-xs font-bold text-slate-200 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all flex items-center gap-1.5"><LogIn className="w-3.5 h-3.5" />에디터 로그인</Link>
          )}
        </div>
      </div>
    </header>
  )
}
