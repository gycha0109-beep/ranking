import Link from 'next/link'
import { GitCompareArrows, ShieldCheck } from 'lucide-react'
import { getReviewedEquivalenceEvidence } from '@/lib/actions/reviewed-equivalence-evidence'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ from?: string | string[]; to?: string | string[] }>
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function boundedDate(value: string | undefined, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value! : fallback
}

function percent(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)}%` : '0.0%'
}

export default async function ReviewedEquivalenceEvidencePage({ searchParams }: Props) {
  const params = await searchParams
  const today = new Date()
  const start = new Date(today)
  start.setUTCDate(start.getUTCDate() - 29)
  const to = boundedDate(first(params.to), isoDate(today))
  const from = boundedDate(first(params.from), isoDate(start))
  const result = await getReviewedEquivalenceEvidence(from, to)
  const evidence = result.data

  return (
    <div className="min-h-screen bg-[#090a0d] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="border-b border-white/[0.07] pb-6">
          <Link href="/admin/measure" className="text-xs font-bold text-indigo-300 hover:text-indigo-200">← Product & Semantic Evidence</Link>
          <div className="mt-4 flex items-center gap-3">
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-sky-300">
              <GitCompareArrows className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-300">IA-2L</p>
              <h1 className="mt-1 text-3xl font-black text-white">Reviewed Equivalence Evidence</h1>
            </div>
          </div>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-500">
            기존 IA-2D append-only governance stream에서 finalized semantic decision만 읽습니다. candidate 목록은 최종 저장 시 서버가 deterministic하게 계산한 가용 후보이며, 실제 UI 노출을 확인한 로그로 해석하지 않습니다.
          </p>
        </header>

        <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4" method="get">
          <label className="text-xs font-bold text-slate-400">From<input className="mt-1 block rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100" type="date" name="from" defaultValue={from} /></label>
          <label className="text-xs font-bold text-slate-400">To<input className="mt-1 block rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100" type="date" name="to" defaultValue={to} /></label>
          <button className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-black text-white hover:bg-sky-400" type="submit">기간 적용</button>
        </form>

        {result.error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-200">{result.error}</div>
        )}

        {evidence && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Candidate decisions" value={evidence.summary.candidate_available_decisions} />
              <Metric label="Positive reuse" value={evidence.summary.candidate_reuse_positive_decisions} />
              <Metric label="Negative new Subject" value={evidence.summary.candidate_new_negative_decisions} />
              <Metric label="Alias assertions" value={evidence.summary.alias_equivalence_assertions} />
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <Panel title="Decision label balance">
                <Row label="All finalized Subject decisions" value={evidence.summary.subject_decisions} />
                <Row label="Candidate available at final save" value={evidence.summary.candidate_available_decisions} />
                <Row label="Labeled candidate decisions" value={evidence.summary.candidate_decision_labels} />
                <Row label="Unlabeled candidate decisions" value={evidence.summary.candidate_unlabeled_decisions} />
                <Row label="New Subject without candidate" value={evidence.summary.new_without_candidate_decisions} />
                <Row label="Candidate label coverage" value={percent(evidence.summary.candidate_label_coverage_rate)} />
                <Row label="Reuse acceptance among labels" value={percent(evidence.summary.candidate_reuse_acceptance_rate)} />
              </Panel>

              <Panel title="Authority & readiness" icon={<ShieldCheck className="h-4 w-4" />}>
                <Row label="Authority table" value={evidence.authority.event_table} />
                <Row label="MEASURE-1 reused" value={evidence.authority.product_usage_events_reused ? 'YES' : 'NO'} />
                <Row label="Mutation authority" value={evidence.authority.mutation_authority} />
                <Row label="Current Alias rows" value={evidence.current_aliases.length} />
                <Row label="Evidence window truncated" value={evidence.period.event_window_truncated ? 'YES' : 'NO'} />
                <Row label="IA-2D readiness" value={evidence.readiness} />
              </Panel>
            </section>

            <Panel title="Recent finalized candidate decisions">
              {evidence.recent_candidate_decisions.length > 0 ? evidence.recent_candidate_decisions.map(row => (
                <div key={row.id} className="border-t border-white/[0.06] py-4 first:border-t-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${row.label === 'POSITIVE_REUSE' ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : row.label === 'NEGATIVE_NEW_SUBJECT' ? 'border-amber-400/25 bg-amber-400/10 text-amber-200' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}>
                      {row.label}
                    </span>
                    <span className="text-[10px] text-slate-600">{row.created_at}</span>
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-200">input {row.input_subject_key || '—'} → final {row.canonical_subject_key || '—'}</p>
                  <p className="mt-2 break-words text-[10px] leading-5 text-slate-500">candidate keys: {row.candidate_subject_keys.join(', ') || 'none'}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                    <span>selected: {row.selected_subject_key || 'none'}</span>
                    <span>rank: {row.selected_rank ?? '—'}</span>
                    {row.ranking_id && <Link className="font-bold text-sky-300 hover:text-sky-200" href={`/admin/rankings/${row.ranking_id}/edit`}>랭킹 검토</Link>}
                  </div>
                </div>
              )) : <Empty text="이 기간에는 finalized candidate decision evidence가 없습니다." />}
            </Panel>

            <Panel title="Recent reviewed Alias equivalence assertions">
              {evidence.recent_alias_assertions.length > 0 ? evidence.recent_alias_assertions.map(row => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] py-3 first:border-t-0">
                  <p className="text-xs font-bold text-slate-200">{row.alias_key || '—'} → {row.canonical_subject_key || '—'}</p>
                  <span className="text-[10px] text-slate-600">{row.created_at}</span>
                </div>
              )) : <Empty text="이 기간에는 reviewed Alias assertion이 없습니다." />}
            </Panel>

            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.06] p-5 text-xs leading-6 text-amber-100/80">
              `POSITIVE_REUSE`는 deterministic candidate를 선택해 저장한 finalized decision입니다. `NEGATIVE_NEW_SUBJECT`는 candidate가 서버 기준으로 존재했지만 새 Subject를 저장한 decision-level negative evidence입니다. 어느 쪽도 전역 SAME_CONCEPT / DIFFERENT_CONCEPT ontology truth로 승격하지 않으며, 실제 UI 노출 증거라고 주장하지 않습니다.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-3 text-2xl font-black text-white">{String(value ?? 0)}</p></div>
}

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"><h2 className="flex items-center gap-2 text-sm font-black text-white">{icon}{title}</h2><div className="mt-4">{children}</div></section>
}

function Row({ label, value }: { label: string; value: unknown }) {
  return <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] py-3 first:border-t-0"><span className="text-xs text-slate-400">{label}</span><span className="text-right text-xs font-black text-slate-100">{String(value ?? 0)}</span></div>
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-white/10 px-4 py-7 text-center text-xs text-slate-600">{text}</div>
}
