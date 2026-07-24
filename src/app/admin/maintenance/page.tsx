import { Clock3, DatabaseZap, ShieldCheck } from 'lucide-react'
import { loadMaintenanceAdminData } from '@/lib/actions/maintenance-admin'

export const dynamic = 'force-dynamic'

const statusLabels: Record<string, string> = {
  succeeded: '성공',
  no_work: '처리 대상 없음',
  failed: '실패',
  skipped_locked: '중복 실행 건너뜀',
  disabled: '비활성',
}

export default async function MaintenanceAdminPage() {
  const data = await loadMaintenanceAdminData()

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-2 text-cyan-300"><DatabaseZap className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-widest">Maintenance Control</span></div>
          <h1 className="mt-2 text-3xl font-black text-white">운영 유지보수 자동화</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Cron 등록 상태, 보존정책, 최근 실행 결과를 조회합니다. 브라우저에서는 작업을 직접 실행하거나 설정을 변경할 수 없습니다.</p>
        </header>

        {data.error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{data.error}</div>}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.jobs.map((raw) => {
            const row = raw as Record<string, unknown>
            const registered = row.cron_registered === true
            const active = row.cron_active === true
            return (
              <article key={String(row.job_key)} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-white">{String(row.job_key)}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{String(row.description)}</p>
                  </div>
                  <span className={`rounded-lg border px-2 py-1 text-[10px] font-black ${registered && active ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/20 bg-rose-500/10 text-rose-200'}`}>{registered && active ? 'CRON ACTIVE' : 'CRON ERROR'}</span>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
                  <div><dt className="text-slate-600">Schedule UTC</dt><dd className="mt-1 font-bold text-slate-300">{String(row.schedule)}</dd></div>
                  <div><dt className="text-slate-600">Batch</dt><dd className="mt-1 font-bold text-slate-300">{String(row.batch_size)} × {String(row.max_batches)}</dd></div>
                  <div className="col-span-2"><dt className="text-slate-600">보존정책</dt><dd className="mt-1 text-slate-300">{String(row.retention_policy)}</dd></div>
                  <div><dt className="text-slate-600">최근 상태</dt><dd className="mt-1 font-bold text-slate-300">{statusLabels[String(row.last_status)] || String(row.last_status || '미실행')}</dd></div>
                  <div><dt className="text-slate-600">처리 건수</dt><dd className="mt-1 font-bold text-slate-300">{Number(row.last_affected_rows || 0).toLocaleString('ko-KR')}</dd></div>
                </dl>
                {row.last_finished_at && <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-600"><Clock3 className="h-3.5 w-3.5" />{new Date(String(row.last_finished_at)).toLocaleString('ko-KR')}</p>}
                {row.last_error_message && <p className="mt-3 rounded-xl border border-rose-500/15 bg-rose-500/[0.07] p-3 text-xs text-rose-200">{String(row.last_error_code)} · {String(row.last_error_message)}</p>}
              </article>
            )
          })}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /><h2 className="font-black text-white">최근 실행 원장</h2></div>
          {data.runs.map((raw) => {
            const row = raw as Record<string, unknown>
            return (
              <article key={String(row.id)} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-black text-white">{String(row.job_key)} · {statusLabels[String(row.status)] || String(row.status)}</p><p className="mt-1 text-xs text-slate-500">{String(row.trigger_source)} · batch {String(row.batch_count)} · {Number(row.affected_rows || 0).toLocaleString('ko-KR')}건</p></div>
                  <time className="text-xs text-slate-600">{new Date(String(row.finished_at)).toLocaleString('ko-KR')}</time>
                </div>
                {row.error_message && <p className="mt-3 rounded-xl bg-black/25 p-3 text-xs text-rose-200">{String(row.error_code)} · {String(row.error_message)}</p>}
              </article>
            )
          })}
          {data.runs.length === 0 && !data.error && <p className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-8 text-center text-sm text-slate-500">실행 기록이 없습니다.</p>}
        </section>
      </div>
    </div>
  )
}
