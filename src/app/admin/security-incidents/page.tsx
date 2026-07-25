import Link from 'next/link'
import { AlertTriangle, Filter, Search, ShieldCheck, Siren, UserRoundCheck } from 'lucide-react'
import {
  getAdminSecurityIncidentSummary,
  listAdminSecurityIncidents,
  listSecurityIncidentAssignees,
} from '@/lib/actions/admin-security-incidents'
import {
  ADMIN_SECURITY_INCIDENT_SEVERITIES,
  ADMIN_SECURITY_INCIDENT_STATUSES,
  type AdminSecurityIncidentSeverity,
  type AdminSecurityIncidentStatus,
} from '@/lib/admin-security-incidents'

export const dynamic = 'force-dynamic'

type SearchParams = {
  status?: string | string[]
  severity?: string | string[]
  actor?: string
  assignee?: string
  fingerprint?: string
  from?: string
  to?: string
  scope?: string
  cursorAt?: string
  cursorId?: string
}

type Props = { searchParams: Promise<SearchParams> }

const statusLabels: Record<AdminSecurityIncidentStatus, string> = {
  open: '미확인',
  acknowledged: '확인됨',
  resolved: '해결',
  false_positive: '오탐',
}

const severityLabels: Record<AdminSecurityIncidentSeverity, string> = {
  medium: '주의',
  high: '높음',
  critical: '긴급',
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

function formatDate(value: string | null) {
  if (!value) return '없음'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR')
}

function nextUrl(params: SearchParams, cursor: { lastDetectedAt: string; id: string }) {
  const query = new URLSearchParams()
  values(params.status).forEach((item) => query.append('status', item))
  values(params.severity).forEach((item) => query.append('severity', item))
  if (params.actor) query.set('actor', params.actor)
  if (params.assignee) query.set('assignee', params.assignee)
  if (params.fingerprint) query.set('fingerprint', params.fingerprint)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.scope) query.set('scope', params.scope)
  query.set('cursorAt', cursor.lastDetectedAt)
  query.set('cursorId', cursor.id)
  return `/admin/security-incidents?${query.toString()}`
}

export default async function AdminSecurityIncidentsPage({ searchParams }: Props) {
  const params = await searchParams
  const requestedStatuses = values(params.status).filter((item): item is AdminSecurityIncidentStatus => (
    ADMIN_SECURITY_INCIDENT_STATUSES as readonly string[]
  ).includes(item))
  const statuses = requestedStatuses.length > 0
    ? requestedStatuses
    : params.scope === 'all'
      ? []
      : ['open', 'acknowledged'] as AdminSecurityIncidentStatus[]
  const severities = values(params.severity).filter((item): item is AdminSecurityIncidentSeverity => (
    ADMIN_SECURITY_INCIDENT_SEVERITIES as readonly string[]
  ).includes(item))

  const [summary, result, assignees] = await Promise.all([
    getAdminSecurityIncidentSummary(),
    listAdminSecurityIncidents({
      statuses,
      severities,
      actorId: params.actor,
      assigneeId: params.assignee,
      fingerprint: params.fingerprint,
      from: dateStart(params.from),
      to: dateEnd(params.to),
      cursor: params.cursorAt && params.cursorId
        ? { lastDetectedAt: params.cursorAt, id: params.cursorId }
        : null,
      limit: 50,
    }),
    listSecurityIncidentAssignees(),
  ])

  const cards = [
    { label: '활성 사건', count: summary.data?.activeCount || 0, icon: Siren },
    { label: '미확인', count: summary.data?.openCount || 0, icon: AlertTriangle },
    { label: '고위험·긴급', count: summary.data?.highCriticalActiveCount || 0, icon: ShieldCheck },
    { label: '미배정', count: summary.data?.unassignedActiveCount || 0, icon: UserRoundCheck },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-2 text-rose-300">
            <Siren className="h-5 w-5" />
            <span className="text-xs font-black uppercase tracking-widest">Security Incident Response</span>
          </div>
          <h1 className="mt-2 text-3xl font-black text-white">운영 보안 사건 대응</h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-500">반복·고위험 운영 telemetry를 사건 단위로 확인하고 담당자 지정, 확인, 종결 및 재개 이력을 관리합니다.</p>
        </header>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm leading-relaxed text-amber-100">
          이 사건은 <strong>authenticated_self_report 운영 triage 신호</strong>입니다. 단독 제재 근거나 침해 확정 증거가 아니며 원본 운영 감사·서비스 로그와 함께 검토해야 합니다.
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ label, count, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500">{label}</p>
                <Icon className="h-4 w-4 text-rose-300" />
              </div>
              <p className="mt-2 text-2xl font-black text-white">{count.toLocaleString('ko-KR')}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-black text-white"><Filter className="h-4 w-4 text-indigo-300" /> 사건 필터</div>
            <div className="flex gap-2 text-xs font-bold">
              <Link href="/admin/security-incidents" className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-rose-200">활성만</Link>
              <Link href="/admin/security-incidents?scope=all" className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300">전체 포함</Link>
            </div>
          </div>

          <form className="space-y-4">
            {params.scope === 'all' && <input type="hidden" name="scope" value="all" />}
            <div>
              <p className="mb-2 text-xs font-bold text-slate-400">상태</p>
              <div className="flex flex-wrap gap-2">
                {ADMIN_SECURITY_INCIDENT_STATUSES.map((status) => (
                  <label key={status} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                    <input type="checkbox" name="status" value={status} defaultChecked={statuses.includes(status)} /> {statusLabels[status]}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold text-slate-400">심각도</p>
              <div className="flex flex-wrap gap-2">
                {ADMIN_SECURITY_INCIDENT_SEVERITIES.map((severity) => (
                  <label key={severity} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                    <input type="checkbox" name="severity" value={severity} defaultChecked={severities.includes(severity)} /> {severityLabels[severity]}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <input name="actor" defaultValue={params.actor || ''} placeholder="Telemetry 행위자 UUID" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
              <select name="assignee" defaultValue={params.assignee || ''} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white">
                <option value="">담당자 전체</option>
                {assignees.data.map((assignee) => <option key={assignee.userId} value={assignee.userId}>{assignee.displayName}</option>)}
              </select>
              <input name="fingerprint" defaultValue={params.fingerprint || ''} placeholder="Fingerprint exact" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
              <input type="date" name="from" defaultValue={params.from || ''} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
              <input type="date" name="to" defaultValue={params.to || ''} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
            </div>

            <div className="flex gap-3">
              <button className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/15 px-5 py-2.5 text-xs font-black text-indigo-200"><Search className="h-4 w-4" /> 조회</button>
              <Link href="/admin/security-incidents" className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-xs font-black text-slate-300">초기화</Link>
            </div>
          </form>
        </section>

        {(summary.error || result.error || assignees.error) && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{summary.error || result.error || assignees.error}</div>
        )}

        <section className="space-y-3">
          {result.data.map((incident) => (
            <article key={incident.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] font-black text-rose-200">{severityLabels[incident.severity]}</span>
                    <span className="rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[10px] font-black text-indigo-200">{statusLabels[incident.status]}</span>
                    <span className="font-black text-white">{incident.actionKey}</span>
                    <span className="text-xs text-slate-500">{incident.failureCode}</span>
                  </div>
                  <p className="text-sm text-slate-300">{incident.resourceKey} · {incident.routeKey}</p>
                  <p className="text-xs text-slate-500">행위자 {incident.telemetryActorLabel} · {incident.telemetryActorId}</p>
                  <p className="text-xs text-slate-500">담당 {incident.assigneeLabel || '미배정'} · 최근 대상 표본 {incident.subjectType}:{incident.latestSubjectRef}</p>
                  <p className="break-all text-[10px] text-slate-600">{incident.fingerprint}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-white">{incident.windowOccurrenceCount.toLocaleString('ko-KR')}회</p>
                  <p className="mt-1 text-xs text-slate-500">최근 60분 · 누적 {incident.lifetimeOccurrenceCount.toLocaleString('ko-KR')}회</p>
                  <p className="mt-2 text-xs text-slate-500">최근 {formatDate(incident.lastDetectedAt)}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/admin/security-incidents/${encodeURIComponent(incident.id)}`} className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200">사건 대응</Link>
                <Link href={`/admin/audit?correlation=${encodeURIComponent(`security-incident:${incident.id}`)}`} className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200">감사 흐름</Link>
                <Link href={`/admin/security-events?actor=${encodeURIComponent(incident.telemetryActorId)}&action=${encodeURIComponent(incident.actionKey)}`} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-slate-300">원본 telemetry</Link>
              </div>
            </article>
          ))}

          {result.data.length === 0 && !result.error && (
            <p className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-8 text-center text-sm text-slate-500">조건에 맞는 보안 사건이 없습니다.</p>
          )}
        </section>

        {result.nextCursor && (
          <div className="flex justify-center"><Link href={nextUrl(params, result.nextCursor)} className="rounded-xl border border-indigo-500/25 bg-indigo-500/15 px-6 py-3 text-sm font-black text-indigo-200">다음 사건</Link></div>
        )}
      </div>
    </div>
  )
}
