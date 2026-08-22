import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/actions/auth'
import SearchForm from '@/components/SearchForm'
import {
  Bell,
  Bookmark,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Scale,
  Search,
  UserRound,
} from 'lucide-react'

const navLink = 'inline-flex min-h-10 items-center px-1 text-sm font-black tracking-[-0.02em] text-[#303640] transition hover:text-[#2563eb]'
const iconButton = 'relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e1e4e8] bg-white text-[#414955] transition hover:border-[#bdc5cf] hover:bg-[#f7f8fa] hover:text-[#2563eb]'

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
    <header className="sticky top-0 z-50 border-b border-[#e7e9ed] bg-white/95 backdrop-blur-xl">
      <div className="rw-container flex h-[64px] items-center justify-between gap-3 sm:h-[68px]">
        <div className="flex min-w-0 items-center gap-5 lg:gap-7">
          <Link href="/" className="shrink-0 text-[19px] font-black tracking-[-0.055em] text-[#111318] transition hover:text-[#2563eb] sm:text-[21px]" aria-label="랭킹위키 홈">
            RANKINGWIKI
          </Link>

          <nav className="hidden items-center gap-5 md:flex" aria-label="주요 메뉴">
            <Link href="/search" className={navLink}>탐색</Link>
            <Link href="/categories" className={navLink}>카테고리</Link>
            {user && <Link href="/me/bookmarks" className={navLink}>저장됨</Link>}
          </nav>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <div className="hidden w-full max-w-[430px] lg:block">
            <SearchForm compact />
          </div>
          <Link href="/search" className={`${iconButton} lg:hidden`} title="통합 검색" aria-label="통합 검색">
            <Search className="h-4 w-4" />
          </Link>

          {user ? (
            <>
              <Link href="/me/notifications" className={iconButton} title="내 알림" aria-label={`내 알림${unreadNotificationCount > 0 ? `, 읽지 않음 ${unreadNotificationCount}개` : ''}`}>
                <Bell className="h-4 w-4" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full border-2 border-white bg-[#2563eb] px-1 text-center text-[9px] font-black leading-4 text-white">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </Link>

              <details className="relative hidden md:block">
                <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-[#e1e4e8] bg-white px-3 text-xs font-bold text-[#3f4752] transition hover:border-[#bdc5cf] hover:bg-[#f7f8fa]">
                  <UserRound className="h-4 w-4 text-[#2563eb]" />
                  <span className="max-w-32 truncate">{user.email}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#89919c]" />
                </summary>
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-[12px] border border-[#e1e4e8] bg-white p-2 shadow-[0_18px_45px_rgba(20,30,50,0.12)]">
                  <Link href="/me/bookmarks" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-[#4b5563] hover:bg-[#f5f7fa] hover:text-[#171a1f]">
                    <Bookmark className="h-4 w-4" />저장한 콘텐츠
                  </Link>
                  <Link href="/me/sanctions" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-[#4b5563] hover:bg-[#f5f7fa] hover:text-[#171a1f]">
                    <Scale className="h-4 w-4" />제재·이의제기
                  </Link>
                  {isOperator && (
                    <Link href="/admin" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-[#2563eb] hover:bg-[#eff6ff]">
                      <LayoutDashboard className="h-4 w-4" />운영 콘솔
                    </Link>
                  )}
                  <form action={async () => { 'use server'; await signOut() }} className="mt-1 border-t border-[#eceef1] pt-1">
                    <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-[#be4057] hover:bg-[#fff1f2]">
                      <LogOut className="h-4 w-4" />로그아웃
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <Link href="/login" className="inline-flex h-10 items-center rounded-full px-3 text-xs font-black text-[#171a1f] transition hover:bg-[#f5f7fa] hover:text-[#2563eb] sm:px-4">
              로그인
            </Link>
          )}

          <details className="relative md:hidden">
            <summary className={`${iconButton} cursor-pointer list-none`} aria-label="메뉴 열기">
              <Menu className="h-4 w-4" />
            </summary>
            <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-[14px] border border-[#e1e4e8] bg-white p-2 shadow-[0_18px_45px_rgba(20,30,50,0.12)]">
              <Link href="/search" className="block rounded-lg px-3 py-3 text-sm font-extrabold text-[#303740] hover:bg-[#f5f7fa]">탐색</Link>
              <Link href="/categories" className="block rounded-lg px-3 py-3 text-sm font-extrabold text-[#303740] hover:bg-[#f5f7fa]">카테고리</Link>
              {user && (
                <>
                  <Link href="/me/bookmarks" className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-[#3f4752] hover:bg-[#f5f7fa]">
                    <Bookmark className="h-4 w-4" />저장한 콘텐츠
                  </Link>
                  <Link href="/me/notifications" className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-[#3f4752] hover:bg-[#f5f7fa]">
                    <Bell className="h-4 w-4" />알림 {unreadNotificationCount > 0 ? `(${unreadNotificationCount})` : ''}
                  </Link>
                  <Link href="/me/sanctions" className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-[#3f4752] hover:bg-[#f5f7fa]">
                    <Scale className="h-4 w-4" />제재·이의제기
                  </Link>
                  {isOperator && (
                    <Link href="/admin" className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-[#2563eb] hover:bg-[#eff6ff]">
                      <LayoutDashboard className="h-4 w-4" />운영 콘솔
                    </Link>
                  )}
                  <form action={async () => { 'use server'; await signOut() }} className="mt-1 border-t border-[#eceef1] pt-1">
                    <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-semibold text-[#be4057] hover:bg-[#fff1f2]">
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
