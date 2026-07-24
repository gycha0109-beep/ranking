import { redirect } from 'next/navigation'
import { AlertTriangle, Clock3, FileText, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { listMyUserSanctions, submitUserSanctionAppeal } from '@/lib/actions/user-sanctions'

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  warning: '운영 경고',
  comment_restriction: '댓글 기능 제한',
  report_restriction: '신고 기능 제한',
  account_suspension: '계정 활동 제한',
}

const STATE_LABELS: Record<string, string> = {
  active: '유효',
  expired: '만료',
  revoked: '조기 해제',
  overturned: '원결정 취소',
}

export default async function MySanctionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=%2Fme%2Fsanctions')

  const result = await listMyUserSanctions()

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-2 text-amber-300">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-black uppercase tracking-widest">Account Decisions</span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">내 제재·이의제기</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            본인에게 기록된 운영 결정과 현재 효력, 이의제기 처리 상태를 확인합니다. 다른 사용자의 정보는 공개되지 않습니다.
          </p>
        </header>

        {result.error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{result.error}</div>
        )}

        {!result.error && result.data.length === 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-sm text-slate-500">
            기록된 계정 제재가 없습니다.
          </div>
        )}

        <div className="space-y-5">
          {result.data.map((sanction) => (
            <article key={sanction.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-300" />
                    <h2 className="font-black text-white">{TYPE_LABELS[sanction.type] || sanction.type}</h2>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-slate-300">
                      {STATE_LABELS[sanction.state] || sanction.state}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">사유 코드: {sanction.reason}</p>
                </div>
                <div className="text-xs text-slate-500">
                  <div className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />시작 {new Date(sanction.startsAt).toLocaleString('ko-KR')}</div>
                  {sanction.endsAt && <div className="mt-1 text-right">종료 {new Date(sanction.endsAt).toLocaleString('ko-KR')}</div>}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.05] bg-black/20 p-3 text-xs text-slate-400">
                근거 유형: {sanction.sourceType}
              </div>

              {sanction.appeal ? (
                <div className="mt-4 rounded-xl border border-indigo-500/15 bg-indigo-500/[0.06] p-4">
                  <div className="flex items-center gap-2 text-xs font-black text-indigo-300"><FileText className="h-4 w-4" />이의제기 제출됨</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{sanction.appeal.statement}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    처리 상태: {sanction.appeal.decision === 'accepted' ? '수용' : sanction.appeal.decision === 'rejected' ? '기각' : '검토 대기'}
                  </p>
                </div>
              ) : sanction.canAppeal ? (
                <form action={submitUserSanctionAppeal} className="mt-4 space-y-3 rounded-xl border border-white/[0.06] bg-black/20 p-4">
                  <input type="hidden" name="sanctionId" value={sanction.id} />
                  <label className="block text-xs font-bold text-slate-300" htmlFor={`appeal-${sanction.id}`}>이의제기 내용</label>
                  <textarea
                    id={`appeal-${sanction.id}`}
                    name="statement"
                    required
                    minLength={20}
                    maxLength={2000}
                    rows={4}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/40"
                    placeholder="결정이 잘못되었다고 판단하는 이유와 확인할 수 있는 사실을 20자 이상 작성해 주세요."
                  />
                  <button type="submit" className="rounded-xl border border-indigo-500/25 bg-indigo-500/15 px-4 py-2 text-xs font-black text-indigo-200 hover:bg-indigo-500/25">
                    이의제기 제출
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
