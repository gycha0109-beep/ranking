import Link from 'next/link'
import { AlertTriangle, Filter, Search, ShieldAlert } from 'lucide-react'
import { getAdminSecurityEventOverview, listAdminSecurityEvents } from '@/lib/actions/admin-security-events'
import {
  ADMIN_SECURITY_EVENT_KINDS,
  ADMIN_SECURITY_RISK_LEVELS,
  type AdminSecurityEventKind,
  type AdminSecurityRiskLevel,
} from '@/lib/admin-security-events'

export const dynamic = 'force-dynamic'

type SearchParams = {
  kind?: string | string[]
  risk?: string | string[]
  actor?: string
  action?: string
  from?: string
  to?: string
  min?: string
  cursorAt?: string
  cursorId?: string
}

type Props = { searchParams: Promise<SearchParams> }

const kindLabels: Record<AdminSecurityEventKind, string> = {
  permission_denied: '권한 거부',
  validation_failed: '검증 실패',
  conflict: '동시성 충돌',
  command_failed: '명령 실패',
  suspicious_query: '비정상 조회',
}

const riskLabels: Record<AdminSecurityRiskLevel, string> = {
  low: '낮음',
  medium: '주의',
  high: '높음',
}

function values(value?: string | string[]) {
  return Array.isArray(value) ? value : value ? [value] : []
}

function dateStart(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00+09:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function dateEnd(value?: string) {
  const start = dateStart(value)
  if (!start) return null
  const date = new Date(start)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString()
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR')
}

function nextUrl(params: SearchParams, cursor: { lastSeenAt: string; id: number }) {
  const query = new URLSearchParams()
  values(params.kind).forEach((item) => query.append('kind', item))
  values(params.risk).forEach((item) => query.append('risk', item))
  if (params.actor) query.set('actor', params.actor)
  if (params.action) query.set('action', params.action)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.min) query.set('min', params.min)
  query.set('cursorAt', cursor.lastSeenAt)
  query.set('cursorId', String(cursor.id))
  return `/admin/security-events?${query.toString()}`
}

export default async function AdminSecurityEventsPage({ searchParams }: Props) {
  const params = await searchParams
  const eventKinds = values(params.kind).filter((item): item is AdminSecurityEventKind => (
    ADMIN_SECURITY_EVENT_KINDS as readonly string[]
  ).includes(item))
  const riskLevels = values(params.risk).filter((item): item is AdminSecurityRiskLevel => (
    ADMIN_SECURITY_RISK_LEVELS as readonly string[]
  ).includes(item))
  const cursorId = params.cursorId ? Number(params.cursorId) : null
  const minOccurrence = params.min ? Number(params.min) : 1

  const [overview, result] = await Promise.all([
    getAdminSecurityEventOverview(24),
    listAdminSecurityEvents({
      eventKinds,
      riskLevels,
      actorId: params.actor,
      actionKey: params.action,
      from: dateStart(params.from),
      to: dateEnd(params.to),
      minOccurrence: Number.isFinite(minOccurrence) ? minOccurrence : 1,
      cursor: params.cursorAt && cursorId ? { lastSeenAt: params.cursorAt, id: cursorId } : null,
      limit: 50,
    }),
  ])

  const cards = [
    ['24시간 발생', overview.data?.totalOccurrences || 0],
    ['집계 버킷', overview.data?.totalBuckets || 0],
    ['고위험', overview.data?.highBuckets || 0],
    ['반복 이벤트', overview.data?.repeatedBuckets || 0],
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-2 text-rose-300">
            <ShieldAlert className="h-5 w-5" />
            <span className="text-xs font-black uppercase tracking-widest">Security Telemetry</span>
          </div>
          <h1 className="mt-2 text-3xl font-black text-white">운영 보안 이벤트</h1>
          <p className="mt-2 text-sm text-slate-500">실패한 관리자 작업을 원문 없이 집계해 반복 권한 거부, 검증 실패, 충돌 및 비정상 조회 패턴을 확인합니다.</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([label, count]) => (
            <div key={String(label)} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <p className="text-xs font-bold text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-white">{Number(count).toLocaleString('ko-KR')}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-black text-white"><Filter className="h-4 w-4 text-indigo-300" /> 필터</div>
          <form className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-bold text-slate-400">이벤트 종류</p>
              <div className="flex flex-wrap gap-2">
                {ADMIN_SECURITY_EVENT_KINDS.map((kind) => (
                  <label key={kind} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                    <input type="checkbox" name="kind" value={kind} defaultChecked={eventKinds.includes(kind)} /> {kindLabels[kind]}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold text-slate-400">위험도</p>
              <div className="flex flex-wrap gap-2">
                {ADMIN_SECURITY_RISK_LEVELS.map((risk) => (
                  <label key={risk} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                    <input type="checkbox" name="risk" value={risk} defaultChecked={riskLevels.includes(risk)} /> {riskLabels[risk]}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <input name="actor" defaultValue={params.actor || ''} placeholder="행위자 UUID" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
              <input name="action" defaultValue={params.action || ''} placeholder="action key" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
              <input type="date" name="from" defaultValue={params.from || ''} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
              <input type="date" name="to" defaultValue={params.to || ''} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
              <input type="number" min="1" max="1000000" name="min" defaultValue={params.min || '1'} placeholder="최소 발생 횟수" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
            </div>
            <div className="flex gap-3">
              <button className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/15 px-5 py-2.5 text-xs font-black text-indigo-200"><Search className="h-4 w-4" /> 조회</button>
              <Link href="/admin/security-events" className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-xs font-black text-slate-300">초기화</Link>
            </div>
          </form>
        </section>

        {(overview.error || result.error) && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{overview.error || result.error}</div>
        )}

        <section className="space-y-3">
          {result.data.map((event) => (
            <article key={event.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] font-black text-rose-200">{kindLabels[event.eventKind]}</span>
                    <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-200">{riskLabels[event.riskLevel]}</span>
                    <span className="font-black text-white">{event.actionKey}</span>
                    <span className="text-xs text-slate-500">{event.failureCode}</span>
                  </div>
                  <p className="text-sm text-slate-300">{event.resourceKey} · {event.routeKey}</p>
                  <p className="text-xs text-slate-500">{event.actorLabel} · {event.actorRoleLevel} · {event.actorId}</p>
                  <p className="text-xs text-slate-500">대상 {event.subjectType}:{event.lastSubjectRef} · 신뢰도 {event.sourceTrust}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-white">{event.occurrenceCount.toLocaleString('ko-KR')}회</p>
                  <p className="mt-1 text-xs text-slate-500">최근 {formatDate(event.lastSeenAt)}</p>
                  <p className="text-xs text-slate-600">최초 {formatDate(event.firstSeenAt)}</p>
                </div>
              </div>
              {event.isRepeated && <div className="mt-4 flex items-center gap-2 text-xs font-bold text-amber-200"><AlertTriangle className="h-4 w-4" /> 반복 발생 기준을 초과했습니다.</div>}
            </article>
          ))}
          {result.data.length === 0 && !result.error && <p className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-8 text-center text-sm text-slate-500">조건에 맞는 보안 이벤트가 없습니다.</p>}
        </section>

        {result.nextCursor && (
          <div className="flex justify-center"><Link href={nextUrl(params, result.nextCursor)} className="rounded-xl border border-indigo-500/25 bg-indigo-500/15 px-6 py-3 text-sm font-black text-indigo-200">다음 기록</Link></div>
        )}
      </div>
    </div>
  )
}
