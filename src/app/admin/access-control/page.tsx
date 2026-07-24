import { ShieldCheck, UserCog } from 'lucide-react'
import { listAdminRoleChangeEvents, searchAdminRoleCandidates, setAdminRoleLevel } from '@/lib/actions/admin-access'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ q?: string }> }

const roleLabels: Record<string, string> = {
  none: '일반 사용자',
  moderator: '모더레이터',
  admin: '관리자',
  super_admin: '최고 관리자',
}

export default async function AccessControlPage({ searchParams }: Props) {
  const { q = '' } = await searchParams
  const [candidates, events] = await Promise.all([
    q.trim().length >= 2 ? searchAdminRoleCandidates(q) : Promise.resolve({ data: [] }),
    listAdminRoleChangeEvents(),
  ])

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-2 text-indigo-300"><UserCog className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-widest">Access Control</span></div>
          <h1 className="mt-2 text-3xl font-black text-white">운영 역할 관리</h1>
          <p className="mt-2 text-sm text-slate-500">최고 관리자만 역할을 변경할 수 있으며 자기 역할 변경과 마지막 최고 관리자 제거는 차단됩니다.</p>
        </header>

        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <form className="flex gap-3">
            <input name="q" defaultValue={q} minLength={2} placeholder="표시 이름 또는 사용자 UUID" className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" />
            <button className="rounded-xl border border-indigo-500/25 bg-indigo-500/15 px-5 py-2 text-xs font-black text-indigo-200">검색</button>
          </form>
          {'error' in candidates && candidates.error && <p className="mt-3 text-sm text-rose-300">{candidates.error}</p>}
        </section>

        {candidates.data.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-black text-white">검색 결과</h2>
            {candidates.data.map((raw) => {
              const row = raw as Record<string, unknown>
              return (
                <article key={String(row.user_id)} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-black text-white">{String(row.display_name || '알 수 없는 사용자')}</p>
                      <p className="mt-1 text-xs text-slate-500">{String(row.user_id)} · 현재 {roleLabels[String(row.current_level)] || String(row.current_level)}</p>
                    </div>
                    <form action={setAdminRoleLevel} className="grid gap-2 md:grid-cols-[150px_280px_auto]">
                      <input type="hidden" name="targetUserId" value={String(row.user_id)} />
                      <select name="newLevel" required className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
                        <option value="none">일반 사용자</option><option value="moderator">모더레이터</option><option value="admin">관리자</option><option value="super_admin">최고 관리자</option>
                      </select>
                      <input name="reason" required minLength={10} maxLength={2000} placeholder="10자 이상의 역할 변경 사유" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" />
                      <button className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-200">변경</button>
                    </form>
                  </div>
                </article>
              )
            })}
          </section>
        )}

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-black text-white"><ShieldCheck className="h-4 w-4 text-emerald-300" />역할 변경 감사 원장</h2>
          {events.error && <p className="text-sm text-rose-300">{events.error}</p>}
          {events.data.map((raw) => {
            const row = raw as Record<string, unknown>
            return (
              <article key={String(row.event_id)} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-bold text-white">{String(row.target_display_name)} · {roleLabels[String(row.previous_level)]} → {roleLabels[String(row.new_level)]}</p><p className="mt-1 text-xs text-slate-500">처리자 {String(row.actor_display_name || '시스템')} · {String(row.target_user_id)}</p></div>
                  <time className="text-xs text-slate-500">{new Date(String(row.created_at)).toLocaleString('ko-KR')}</time>
                </div>
                <p className="mt-3 text-sm text-slate-300">{String(row.reason)}</p>
              </article>
            )
          })}
        </section>
      </div>
    </div>
  )
}
