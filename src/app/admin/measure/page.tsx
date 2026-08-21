import Link from 'next/link'
import { BarChart3, GitBranch, Search, ShieldCheck } from 'lucide-react'
import { getMeasure1Baseline } from '@/lib/actions/measure'
import { getSemanticGovernanceEvidence } from '@/lib/actions/semantic-governance-evidence'

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

export default async function Measure1AdminPage({ searchParams }: Props) {
  const params = await searchParams
  const today = new Date()
  const start = new Date(today)
  start.setUTCDate(start.getUTCDate() - 29)
  const to = boundedDate(first(params.to), isoDate(today))
  const from = boundedDate(first(params.from), isoDate(start))
  const [measureResult, governanceResult] = await Promise.all([
    getMeasure1Baseline(from, to),
    getSemanticGovernanceEvidence(from, to),
  ])

  const { data, error } = measureResult
  const governance = governanceResult.data
  const governanceError = governanceResult.error
  const eligible = data?.eligible || {}
  const search = data?.search || {}
  const qa = data?.qa_internal || {}
  const engagement = data?.engagement || {}
  const discovery = Object.entries(data?.discovery_by_source || {})
  const topQueries = data?.top_queries || []

  return (
    <div className="min-h-screen bg-[#090a0d] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="border-b border-white/[0.07] pb-6">
          <Link href="/admin" className="text-xs font-bold text-indigo-300 hover:text-indigo-200">← 운영 통제 본부</Link>
          <div className="mt-4 flex items-center gap-3">
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-indigo-300"><BarChart3 className="h-5 w-5" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-300">MEASURE-1 + IA-2D</p>
              <h1 className="mt-1 text-3xl font-black text-white">Product & Semantic Evidence</h1>
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">Real-user usage baseline과 관리자 semantic-governance evidence를 같은 운영 화면에서 보되 authority는 분리합니다. IA-2D 이벤트는 MEASURE-1 `product_usage_events`에 섞지 않습니다.</p>
        </header>

        <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4" method="get">
          <label className="text-xs font-bold text-slate-400">From<input className="mt-1 block rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100" type="date" name="from" defaultValue={from} /></label>
          <label className="text-xs font-bold text-slate-400">To<input className="mt-1 block rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100" type="date" name="to" defaultValue={to} /></label>
          <button className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-black text-white hover:bg-indigo-400" type="submit">기간 적용</button>
        </form>

        <section className="space-y-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-300">MEASURE-1</p>
            <h2 className="mt-1 text-xl font-black text-white">Real-user product baseline</h2>
          </div>

          {error && <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-200">{error}</div>}

          {!error && data && (
            <>
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Eligible content views" value={eligible.content_views} />
                <Metric label="Ranking / Item" value={`${Number(eligible.ranking_views || 0)} / ${Number(eligible.item_views || 0)}`} />
                <Metric label="Searches" value={search.searches} />
                <Metric label="Search CTR" value={percent(search.search_result_ctr)} />
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <Panel title="Search quality" icon={<Search className="h-4 w-4" />}>
                  <Row label="Distinct daily searchers" value={search.distinct_daily_searchers} />
                  <Row label="Zero-result searches" value={search.zero_result_searches} />
                  <Row label="Zero-result rate" value={percent(search.zero_result_rate)} />
                  <Row label="Clicked search sessions" value={search.clicked_searches} />
                </Panel>

                <Panel title="Known QA exclusion" icon={<ShieldCheck className="h-4 w-4" />}>
                  <Row label="QA content views" value={qa.content_views} />
                  <Row label="QA searches" value={qa.searches} />
                  <Row label="QA discovery clicks" value={qa.discovery_clicks} />
                  <Row label="Eligible distinct daily viewers" value={eligible.distinct_daily_viewers} />
                </Panel>
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <Panel title="Discovery sources">
                  {discovery.length > 0 ? discovery.map(([key, value]) => <Row key={key} label={key} value={value} />) : <Empty text="아직 eligible discovery click이 없습니다." />}
                </Panel>
                <Panel title="Engagement">
                  <Row label="Likes" value={engagement.likes} />
                  <Row label="Bookmarks" value={engagement.bookmarks} />
                  <Row label="Comments" value={engagement.comments} />
                  <Row label="Reactions" value={engagement.reactions} />
                </Panel>
              </section>

              <Panel title="Recent retained search terms">
                {topQueries.length > 0 ? topQueries.map((row, index) => (
                  <div key={`${row.query || 'redacted'}:${index}`} className="grid grid-cols-[1fr_auto_auto] gap-4 border-t border-white/[0.06] py-3 first:border-t-0">
                    <span className="truncate text-sm text-slate-200">{row.query || '(redacted)'}</span>
                    <span className="text-xs text-slate-500">검색 {Number(row.searches || 0)}</span>
                    <span className="text-xs text-slate-500">0건 {Number(row.zero_result_searches || 0)}</span>
                  </div>
                )) : <Empty text="30일 보존 범위에 표시할 검색어가 없습니다." />}
              </Panel>

              <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.06] p-5 text-xs leading-6 text-amber-100/80">
                Legacy `content_daily_views`는 기존 공개 조회수 표시용으로 유지하지만 MEASURE-1 제품 baseline에는 포함하지 않습니다. Returning-user KPI는 일자별 HMAC contract상 의도적으로 제공하지 않습니다.
              </div>
            </>
          )}
        </section>

        <section className="space-y-5 border-t border-white/[0.07] pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-300">IA-2D</p>
              <h2 className="mt-1 text-xl font-black text-white">Semantic Governance Evidence</h2>
              <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-500">Retrospective snapshot은 현재 corpus 구조를 재생한 controlled evidence이고, organic 지표는 IA-2D 이후 실제 저장된 관리자 결정을 집계합니다. 두 증거를 같은 것으로 해석하지 않습니다.</p>
            </div>
            {governance && (
              <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${governance.readiness === 'MINIMUM_ORGANIC_SAMPLE_REACHED' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
                {governance.readiness}
              </span>
            )}
          </div>

          {governanceError && <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-200">{governanceError}</div>}

          {governance && (
            <>
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Current projections" value={governance.snapshot.projections} />
                <Metric label="Canonical Subjects" value={governance.snapshot.subjects} />
                <Metric label="Singleton ratio" value={percent(governance.snapshot.singleton_ratio)} />
                <Metric label="Organic decisions" value={governance.organic.subject_decisions} />
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <Panel title="Current fragmentation snapshot" icon={<GitBranch className="h-4 w-4" />}>
                  <Row label="Singleton Subjects" value={governance.snapshot.singleton_subjects} />
                  <Row label="Reused Subjects" value={governance.snapshot.reused_subjects} />
                  <Row label="Rankings on reused Subjects" value={governance.snapshot.rankings_on_reused_subjects} />
                  <Row label="Reviewed aliases" value={governance.snapshot.aliases} />
                  <Row label="Duplicate version groups" value={governance.snapshot.duplicate_version_groups} />
                </Panel>

                <Panel title="Organic decision evidence">
                  <Row label="Subject decisions" value={`${governance.organic.subject_decisions} / ${governance.minimum_sample.subject_decisions}`} />
                  <Row label="Suggestion exposures" value={`${governance.organic.suggestion_exposures} / ${governance.minimum_sample.suggestion_exposures}`} />
                  <Row label="New Subject decisions" value={`${governance.organic.new_subject_decisions} / ${governance.minimum_sample.new_subject_decisions}`} />
                  <Row label="Existing Subject reuse" value={governance.organic.existing_subject_reuse} />
                  <Row label="Alias resolutions" value={governance.organic.alias_resolutions} />
                  <Row label="Same-version advisory decisions" value={governance.organic.same_version_advisory_decisions} />
                </Panel>
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <Panel title="Governance rates">
                  <Row label="Subject reuse rate" value={percent(governance.rates.subject_reuse_rate)} />
                  <Row label="Suggestion acceptance" value={percent(governance.rates.suggestion_acceptance_rate)} />
                  <Row label="Top-1 acceptance" value={percent(governance.rates.top1_acceptance_rate)} />
                  <Row label="Alias resolution rate" value={percent(governance.rates.alias_resolution_rate)} />
                </Panel>

                <Panel title="Governance mutations">
                  <Row label="Alias created" value={governance.organic.alias_created} />
                  <Row label="Alias deleted" value={governance.organic.alias_deleted} />
                  <Row label="Projection cleared" value={governance.organic.projections_cleared} />
                  <Row label="Evidence window truncated" value={governance.period.event_window_truncated ? 'YES' : 'NO'} />
                </Panel>
              </section>

              <Panel title="Current Subject density">
                {governance.snapshot.top_subjects.length > 0 ? governance.snapshot.top_subjects.map(row => (
                  <Row key={row.subject_key} label={row.subject_key} value={`${row.usage_count} ranking(s)`} />
                )) : <Empty text="현재 semantic projection이 없습니다." />}
              </Panel>

              <Panel title="Retrospective deterministic replay candidates">
                {governance.retrospective.potential_subject_pairs.length > 0 ? governance.retrospective.potential_subject_pairs.map(pair => (
                  <div key={`${pair.left_subject_key}:${pair.right_subject_key}`} className="grid gap-2 border-t border-white/[0.06] py-3 first:border-t-0 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <p className="text-xs font-bold text-slate-200">{pair.left_subject_key} ↔ {pair.right_subject_key}</p>
                      <p className="mt-1 text-[10px] text-slate-500">matched by {pair.matched_by}: {pair.matched_key}</p>
                    </div>
                    <span className="text-[10px] font-black text-sky-300">score {pair.score}</span>
                  </div>
                )) : <Empty text="현재 deterministic suggestion 기준으로 검토할 인접 Subject pair가 없습니다." />}
                <p className="mt-4 border-t border-white/[0.06] pt-4 text-[10px] leading-5 text-slate-500">이 목록은 SAME_CONCEPT 판정이 아닙니다. 현재 IA-2C 알고리즘을 기존 Subject corpus에 재생해 얻은 수동 검토 후보일 뿐이며, 자동 merge나 alias 생성 근거로 사용하지 않습니다.</p>
              </Panel>

              <div className="rounded-2xl border border-sky-500/15 bg-sky-500/[0.06] p-5 text-xs leading-6 text-sky-100/80">
                IA-2D organic authority는 `ranking_semantic_governance_events`이며 MEASURE-1 `product_usage_events`와 분리됩니다. 최소 표본 전에는 taxonomy 확장·AI 분류·embedding 도입을 정당화하지 않습니다.
              </div>
            </>
          )}
        </section>
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
  return <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] py-3 first:border-t-0"><span className="text-xs text-slate-500">{label}</span><span className="text-sm font-black text-slate-200">{String(value ?? 0)}</span></div>
}

function Empty({ text }: { text: string }) {
  return <p className="py-4 text-xs text-slate-600">{text}</p>
}
