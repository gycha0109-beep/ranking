import { ClipboardList } from 'lucide-react'
import { listAdminAuditEvents } from '@/lib/actions/admin-access'

export const dynamic = 'force-dynamic'

export default async function AdminAuditPage() {
  const result = await listAdminAuditEvents()

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-2 text-emerald-300"><ClipboardList className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-widest">Operator Audit</span></div>
          <h1 className="mt-2 text-3xl font-black text-white">운영 감사 기록</h1>
          <p className="mt-2 text-sm text-slate-500">역할 변경, Moderation, 신고 결정, 제재와 이의제기 결정을 시간순으로 확인합니다.</p>
        </header>

        {result.error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{result.error}</div>}

        <section className="space-y-3">
          {result.data.map((raw) => {
            const row = raw as Record<string, unknown>
            const details = row.details && typeof row.details === 'object' ? JSON.stringify(row.details) : '{}'
            return (
              <article key={`${String(row.event_kind)}:${String(row.event_id)}`} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-black text-white">{String(row.event_kind)} · {String(row.action)}</p><p className="mt-1 text-xs text-slate-500">대상 {String(row.target_label)} · 처리자 {String(row.actor_display_name || '시스템')}</p></div>
                  <time className="text-xs text-slate-500">{new Date(String(row.created_at)).toLocaleString('ko-KR')}</time>
                </div>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-black/25 p-3 text-xs text-slate-300">{details}</pre>
              </article>
            )
          })}
          {result.data.length === 0 && !result.error && <p className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-8 text-center text-sm text-slate-500">표시할 감사 기록이 없습니다.</p>}
        </section>
      </div>
    </div>
  )
}
