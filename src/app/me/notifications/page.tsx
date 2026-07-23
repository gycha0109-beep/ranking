import { redirect } from 'next/navigation'
import { BellRing, ShieldCheck } from 'lucide-react'
import NotificationList from './NotificationList'
import { createClient } from '@/lib/supabase/server'
import { listNotifications } from '@/lib/actions/notifications'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=%2Fme%2Fnotifications')

  const result = await listNotifications({ limit: 20 })

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-col gap-5 border-b border-white/[0.06] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-300">
              <BellRing className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-widest">My Notifications</span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">내 알림</h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-500 sm:text-sm">
              내 댓글의 답글, 운영 검토 결과, 신고 처리 결과와 작성자 경고를 확인합니다.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            본인 전용 · 개인정보 최소화
          </div>
        </div>

        <NotificationList initialPage={result.data} initialError={result.error} />
      </div>
    </div>
  )
}
