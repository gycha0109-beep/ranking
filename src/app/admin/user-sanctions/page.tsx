import { Ban, Gavel, ShieldAlert } from 'lucide-react'
import { imposeUserSanction, loadUserSanctionAdminData, reviewUserSanctionAppeal, revokeUserSanction } from '@/lib/actions/user-sanction-admin'

export const dynamic = 'force-dynamic'

const typeLabels: Record<string, string> = {
  warning: '경고',
  comment_restriction: '댓글 제한',
  report_restriction: '신고 제한',
  account_suspension: '계정 활동 제한',
}

export default async function UserSanctionsAdminPage() {
  const data = await loadUserSanctionAdminData()

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-2 text-rose-300"><ShieldAlert className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-widest">Trust & Safety</span></div>
          <h1 className="mt-2 text-3xl font-black text-white">사용자 제재·이의제기 운영</h1>
          <p className="mt-2 text-sm text-slate-500">명시적 운영 결정만 기록하며, 원장과 이의제기 결정은 수정·삭제할 수 없습니다.</p>
        </header>

        {data.error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{data.error}</div>}

        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-black text-white"><Gavel className="h-4 w-4 text-amber-300" />새 제재 결정</h2>
          <form action={imposeUserSanction} className="mt-5 grid gap-3 md:grid-cols-2">
            <input name="targetUserId" required placeholder="대상 사용자 UUID" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" />
            <select name="sanctionType" required className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
              <option value="warning">경고</option><option value="comment_restriction">댓글 제한</option><option value="report_restriction">신고 제한</option><option value="account_suspension">계정 활동 제한</option>
            </select>
            <select name="reason" required className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
              {['harassment','hate','violence','privacy','illegal','spam','misinformation','repeated_abuse','evasion','other'].map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </select>
            <input name="durationHours" type="number" min="1" max="8760" placeholder="기간(시간), 경고는 비워둠" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" />
            <textarea name="adminNote" required minLength={10} maxLength={2000} rows={3} placeholder="10자 이상의 관리자 판단 근거" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm md:col-span-2" />
            <button className="rounded-xl border border-rose-500/25 bg-rose-500/15 px-4 py-2 text-xs font-black text-rose-200 md:col-span-2">제재 기록</button>
          </form>
        </section>

        <section className="space-y-4">
          <h2 className="font-black text-white">대기 중인 이의제기 · {data.appeals.length}건</h2>
          {data.appeals.map((raw) => {
            const row = raw as Record<string, unknown>
            return (
              <article key={String(row.appeal_id)} className="rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.05] p-5">
                <div className="flex flex-wrap justify-between gap-3"><div><p className="font-black text-white">{String(row.appellant_display_name)} · {typeLabels[String(row.sanction_type)] || String(row.sanction_type)}</p><p className="mt-1 text-xs text-slate-500">사용자 {String(row.appellant_id)} · 제재 {String(row.sanction_id)}</p></div><span className="text-xs text-indigo-300">{new Date(String(row.appeal_created_at)).toLocaleString('ko-KR')}</span></div>
                <p className="mt-4 whitespace-pre-wrap rounded-xl bg-black/20 p-3 text-sm leading-relaxed text-slate-300">{String(row.statement)}</p>
                <form action={reviewUserSanctionAppeal} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <input type="hidden" name="appealId" value={String(row.appeal_id)} />
                  <input name="reviewNote" required minLength={10} maxLength={2000} placeholder="10자 이상의 검토 근거" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" />
                  <button name="decision" value="accepted" className="rounded-xl border border-emerald-500/25 bg-emerald-500/15 px-4 py-2 text-xs font-black text-emerald-200">수용</button>
                  <button name="decision" value="rejected" className="rounded-xl border border-rose-500/25 bg-rose-500/15 px-4 py-2 text-xs font-black text-rose-200">기각</button>
                </form>
              </article>
            )
          })}
        </section>

        <section className="space-y-4">
          <h2 className="font-black text-white">최근 제재 기록</h2>
          {data.sanctions.map((raw) => {
            const row = raw as Record<string, unknown>
            const active = row.effective_state === 'active' && row.sanction_type !== 'warning'
            return (
              <article key={String(row.sanction_id)} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div><p className="font-black text-white">{String(row.target_display_name)} · {typeLabels[String(row.sanction_type)] || String(row.sanction_type)}</p><p className="mt-1 text-xs text-slate-500">{String(row.target_user_id)} · {String(row.effective_state)} · {String(row.reason)}</p><p className="mt-3 text-sm text-slate-300">{String(row.admin_note)}</p></div>
                  {active && row.appeal_status !== 'pending' && (
                    <form action={revokeUserSanction} className="flex min-w-72 flex-col gap-2">
                      <input type="hidden" name="sanctionId" value={String(row.sanction_id)} />
                      <input name="note" required minLength={10} maxLength={2000} placeholder="조기 해제 근거" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs" />
                      <button className="flex items-center justify-center gap-1 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-200"><Ban className="h-3.5 w-3.5" />조기 해제</button>
                    </form>
                  )}
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </div>
  )
}
