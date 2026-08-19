import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getRankingRevalidationStatus,
  listRankingRevalidations,
  recordRankingRevalidation,
  type RevalidationFreshnessState,
  type RevalidationOutcome,
} from '@/lib/actions/content-revalidation'
import { ArrowLeft, CalendarClock, CheckCircle2, History, ShieldAlert } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; error?: string }>
}

const outcomeLabels: Record<RevalidationOutcome, string> = {
  verified_unchanged: '검증 완료 · 변경 없음',
  updated: '검증 후 콘텐츠 갱신 완료',
  source_changed: '출처 변경 감지 · 조치 필요',
  source_unavailable: '출처 확인 불가 · 조치 필요',
}

const stateLabels: Record<RevalidationFreshnessState, string> = {
  not_applicable: '비공개 문서',
  never_reviewed: '재검증 기록 없음',
  attention_required: '조치 필요',
  overdue: '재검증 기한 초과',
  due_soon: '7일 이내 재검증',
  current: '재검증 유효',
}

function formatKst(value: string | null) {
  if (!value) return '없음'
  return new Date(value).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const dynamic = 'force-dynamic'

export default async function RankingRevalidationPage({ params, searchParams }: Props) {
  const { id } = await params
  const query = await searchParams
  const supabase = await createClient()

  const { data: ranking } = await supabase
    .from('rankings')
    .select('id, title, slug, status, ranking_type, published_at')
    .eq('id', id)
    .maybeSingle()

  if (!ranking) {
    redirect('/admin/rankings')
  }

  const [statusResult, historyResult] = await Promise.all([
    getRankingRevalidationStatus(id),
    listRankingRevalidations(id),
  ])

  const status = statusResult.data[0]
  const history = historyResult.data
  const loadError = statusResult.error || historyResult.error

  async function submitRevalidation(formData: FormData) {
    'use server'

    const outcome = String(formData.get('outcome') || '') as RevalidationOutcome
    const nextReviewDate = String(formData.get('next_review_date') || '')
    const reviewNote = String(formData.get('review_note') || '')

    if (!nextReviewDate) {
      redirect(`/admin/rankings/${id}/revalidation?error=${encodeURIComponent('다음 검증일을 입력해 주세요.')}`)
    }

    const result = await recordRankingRevalidation({
      rankingId: id,
      outcome,
      nextReviewAt: `${nextReviewDate}T00:00:00+09:00`,
      reviewNote,
    })

    if (result.error) {
      redirect(`/admin/rankings/${id}/revalidation?error=${encodeURIComponent(result.error)}`)
    }

    redirect(`/admin/rankings/${id}/revalidation?saved=1`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/admin/rankings"
          className="mb-6 inline-flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 랭킹 목록으로 돌아가기
        </Link>

        <div className="mb-8 border-b border-white/[0.06] pb-6">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>{ranking.ranking_type}</span>
            <span>·</span>
            <span>{ranking.status}</span>
            <span>·</span>
            <span>/rankings/{ranking.slug}</span>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{ranking.title}</h1>
          <p className="mt-2 text-sm text-slate-400">
            공식 출처를 다시 확인한 결과와 다음 검증 시점을 append-only 기록으로 남깁니다.
          </p>
        </div>

        {query.saved === '1' && (
          <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-300">
            재검증 기록을 저장했습니다.
          </div>
        )}
        {query.error && (
          <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs font-bold text-rose-300">
            {query.error}
          </div>
        )}
        {loadError && (
          <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs font-bold text-rose-300">
            재검증 상태를 불러오지 못했습니다: {loadError}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
          <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="mb-5 flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-indigo-400" />
              <h2 className="text-sm font-extrabold">현재 재검증 상태</h2>
            </div>

            <dl className="space-y-4 text-xs">
              <div>
                <dt className="text-slate-500">상태</dt>
                <dd className="mt-1 font-bold text-slate-200">
                  {status ? stateLabels[status.freshness_state] : '조회 불가'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">최근 검증</dt>
                <dd className="mt-1 font-semibold text-slate-300">{formatKst(status?.verified_at || null)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">다음 검증 예정</dt>
                <dd className="mt-1 font-semibold text-slate-300">{formatKst(status?.next_review_at || null)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">최근 결과</dt>
                <dd className="mt-1 font-semibold text-slate-300">
                  {status?.outcome ? outcomeLabels[status.outcome] : '없음'}
                </dd>
              </div>
              {status?.review_note && (
                <div>
                  <dt className="text-slate-500">최근 메모</dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-6 text-slate-300">{status.review_note}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="mb-5 flex items-center gap-2">
              {ranking.status === 'published' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-amber-400" />
              )}
              <h2 className="text-sm font-extrabold">재검증 결과 기록</h2>
            </div>

            {ranking.status !== 'published' ? (
              <p className="text-xs leading-6 text-amber-300">
                현재 공개 중인 랭킹만 재검증 완료 기록을 남길 수 있습니다. 수정이 필요하면 기존 OPS-1 절차대로 draft에서 편집·검증한 뒤 재발행하십시오.
              </p>
            ) : (
              <form action={submitRevalidation} className="space-y-4">
                <label className="block text-xs font-bold text-slate-300">
                  검증 결과
                  <select
                    name="outcome"
                    required
                    defaultValue="verified_unchanged"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#111118] px-3 py-2.5 text-xs text-slate-100 outline-none focus:border-indigo-500/40"
                  >
                    {Object.entries(outcomeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-bold text-slate-300">
                  다음 검증일
                  <input
                    name="next_review_date"
                    type="date"
                    required
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#111118] px-3 py-2.5 text-xs text-slate-100 outline-none focus:border-indigo-500/40"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-300">
                  검증 메모
                  <textarea
                    name="review_note"
                    required
                    minLength={5}
                    maxLength={2000}
                    rows={5}
                    placeholder="확인한 공식 출처, 변경 여부, 수정 내용 또는 확인 불가 사유를 기록합니다."
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#111118] px-3 py-2.5 text-xs leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-indigo-500/40"
                  />
                </label>

                <button
                  type="submit"
                  className="w-full rounded-xl border border-indigo-500/30 bg-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-indigo-500"
                >
                  재검증 기록 저장
                </button>
              </form>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <div className="mb-5 flex items-center gap-2">
            <History className="h-5 w-5 text-purple-400" />
            <h2 className="text-sm font-extrabold">재검증 이력</h2>
          </div>

          {history.length === 0 ? (
            <p className="text-xs text-slate-500">아직 기록된 재검증 이력이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {history.map((event) => (
                <article key={event.id} className="rounded-xl border border-white/5 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-xs text-slate-200">{outcomeLabels[event.outcome]}</strong>
                    <span className="text-[10px] font-semibold text-slate-500">{formatKst(event.verified_at)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-400">{event.review_note}</p>
                  <p className="mt-2 text-[10px] font-semibold text-slate-600">
                    다음 검증: {formatKst(event.next_review_at)} · 출처 스냅샷 {event.source_snapshot?.length || 0}건
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
