import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/actions/auth'
import SearchForm from '@/components/SearchForm'
import {
  Bell,
  Bookmark,
  ChevronDown,
  Compass,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Scale,
  Search,
  Trophy,
  UserRound,
} from 'lucide-react'

const navLink = 'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#4b5563] transition hover:bg-[#f1f3f5] hover:text-[#171a1f]'
const iconButton = 'relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dde2e8] bg-white text-[#5f6875] transition hover:border-[#bcc7dc] hover:bg-[#f6f8fb] hover:text-[#2445ad]'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isOperator = false
  let unreadNotificationCount = 0

  if (user) {
    const [accessResult, notificationResult] = await Promise.all([
      supabase.rpc('has_admin_capability', { p_capability: 'admin_console_access' }),
      supabase.rpc('get_my_unread_notification_count'),
    ])
    isOperator = accessResult.data === true
    if (!notificationResult.error) {
      const parsed = Number(notificationResult.data)
      unreadNotificationCount = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#dde2e8]/90 bg-white/95 backdrop-blur-xl">
      <div className="rw-container flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="랭킹위키 홈">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#171a1f] text-white transition group-hover:bg-[#2445ad]">
              <Trophy className="h-4.5 w-4.5" />
            </span>
            <span className="text-lg font-black tracking-[-0.03em] text-[#171a1f]">랭킹위키</span>
          </Link>

          <nav className="hidden items-center md:flex" aria-label="주요 메뉴">
            <Link href="/categories" className={navLink}>
              <Compass className="h-4 w-4" />카테고리
            </Link>
            <Link href="/search?sort=latest&q=%EB%9E%AD%ED%82%B9" className={navLink}>
              최신 랭킹
            </Link>
            {user && (
              <Link href="/me/bookmarks" className={navLink}>
                <Bookmark className="h-4 w-4" />저장됨
              </Link>
            )}
          </nav>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <div className="hidden w-72 xl:block">
            <SearchForm compact />
          </div>
          <Link href="/search" className={`${iconButton} xl:hidden`} title="통합 검색" aria-label="통합 검색">
            <Search className="h-4 w-4" />
          </Link>

          {user ? (
            <>
              <Link href="/me/notifications" className={iconButton} title="내 알림" aria-label={`내 알림${unreadNotificationCount > 0 ? `, 읽지 않음 ${unreadNotificationCount}개` : ''}`}>
                <Bell className="h-4 w-4" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full border-2 border-white bg-[#3457c8] px-1 text-center text-[9px] font-black leading-4 text-white">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </Link>

              <details className="relative hidden md:block">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-[#dde2e8] bg-white px-3 py-2 text-xs font-bold text-[#3f4752] transition hover:bg-[#f6f8fb]">
                  <UserRound className="h-4 w-4 text-[#3457c8]" />
                  <span className="max-w-36 truncate">{user.email}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#8a94a3]" />
                </summary>
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-[#dde2e8] bg-white p-2 shadow-[0_18px_45px_rgba(20,30,50,0.14)]">
                  <Link href="/me/bookmarks" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#4b5563] hover:bg-[#f4f6f8] hover:text-[#171a1f]">
                    <Bookmark className="h-4 w-4" />저장한 콘텐츠
                  </Link>
                  <Link href="/me/sanctions" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#4b5563] hover:bg-[#f4f6f8] hover:text-[#171a1f]">
                    <Scale className="h-4 w-4" />제재·이의제기
                  </Link>
                  {isOperator && (
                    <Link href="/admin" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#2445ad] hover:bg-[#eef2ff]">
                      <LayoutDashboard className="h-4 w-4" />운영 콘솔
                    </Link>
                  )}
                  <form action={async () => { 'use server'; await signOut() }} className="mt-1 border-t border-[#edf0f3] pt-1">
                    <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[#be4057] hover:bg-[#fff1f2]">
                      <LogOut className="h-4 w-4" />로그아웃
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <Link href="/login" className="rw-button-primary h-10 px-4 text-xs">
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">로그인</span>
            </Link>
          )}

          <details className="relative md:hidden">
            <summary className={`${iconButton} cursor-pointer list-none`} aria-label="메뉴 열기">
              <Menu className="h-4 w-4" />
            </summary>
            <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-[#dde2e8] bg-white p-2 shadow-[0_18px_45px_rgba(20,30,50,0.14)]">
              <Link href="/categories" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-[#3f4752] hover:bg-[#f4f6f8]">
                <Compass className="h-4 w-4" />카테고리 탐색
              </Link>
              <Link href="/search" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-[#3f4752] hover:bg-[#f4f6f8]">
                <Search className="h-4 w-4" />통합 검색
              </Link>
              {user && (
                <>
                  <Link href="/me/bookmarks" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-[#3f4752] hover:bg-[#f4f6f8]">
                    <Bookmark className="h-4 w-4" />저장한 콘텐츠
                  </Link>
                  <Link href="/me/notifications" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-[#3f4752] hover:bg-[#f4f6f8]">
                    <Bell className="h-4 w-4" />알림 {unreadNotificationCount > 0 ? `(${unreadNotificationCount})` : ''}
                  </Link>
                  <Link href="/me/sanctions" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-[#3f4752] hover:bg-[#f4f6f8]">
                    <Scale className="h-4 w-4" />제재·이의제기
                  </Link>
                  {isOperator && (
                    <Link href="/admin" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-[#2445ad] hover:bg-[#eef2ff]">
                      <LayoutDashboard className="h-4 w-4" />운영 콘솔
                    </Link>
                  )}
                  <form action={async () => { 'use server'; await signOut() }} className="mt-1 border-t border-[#edf0f3] pt-1">
                    <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#be4057] hover:bg-[#fff1f2]">
                      <LogOut className="h-4 w-4" />로그아웃
                    </button>
                  </form>
                </>
              )}
            </div>
          </details>
        </div>
      </div>
    </header>
  )
}
