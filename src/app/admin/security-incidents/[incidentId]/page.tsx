import Link from 'next/link'
import { ArrowLeft, BellRing, ClipboardCheck, RadioTower, ShieldAlert, UserRoundCog } from 'lucide-react'
import {
  acknowledgeAdminSecurityIncident,
  assignAdminSecurityIncident,
  getAdminSecurityIncidentDetail,
  listSecurityIncidentAssignees,
  reopenAdminSecurityIncident,
  resolveAdminSecurityIncident,
} from '@/lib/actions/admin-security-incidents'
import type {
  AdminSecurityIncidentEvent,
  AdminSecurityIncidentSeverity,
  AdminSecurityIncidentStatus,
} from '@/lib/admin-security-incidents'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ incidentId: string }> }

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

const eventLabels: Record<AdminSecurityIncidentEvent['eventType'], string> = {
  created: '사건 생성',
  signal_updated: '신호 갱신',
  severity_escalated: '심각도 상승',
  alerted: '운영 알림',
  acknowledged: '확인 처리',
  assigned: '담당자 변경',
  resolved: '사건 종결',
  reopened: '사건 재개',
}

function formatDate(value: string | null) {
  if (!value) return '없음'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR')
}

function EventCard({ event }: { event: AdminSecurityIncidentEvent }) {
  return (
    <article className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[10px] font-black text-indigo-200">{eventLabels[event.eventType]}</span>
            {event.reasonCode && <span className="text-xs text-slate-500">{event.reasonCode}</span>}
          </div>
          <p className="mt-2 text-sm text-slate-300">
            {event.previousStatus && event.newStatus && `${statusLabels[event.previousStatus]} → ${statusLabels[event.newStatus]}`}
            {event.previousSeverity && event.newSeverity && ` · ${severityLabels[event.previousSeverity]} → ${severityLabels[event.newSeverity]}`}
          </p>
          <p className="mt-1 text-xs text-slate-500">처리자 {event.actorLabel} · source bucket {event.sourceBucketId || '없음'}</p>
          <p className="mt-1 text-xs text-slate-600">최근 60분 {event.windowOccurrenceCount.toLocaleString('ko-KR')}회 · 사건 누적 {event.lifetimeOccurrenceCount.toLocaleString('ko-KR')}회</p>
          {event.note && <p className="mt-3 whitespace-pre-wrap rounded-lg border border-amber-500/10 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-100">{event.note}</p>}
        </div>
        <time className="text-xs text-slate-500">{formatDate(event.createdAt)}</time>
      </div>
    </article>
  )
}

export default async function AdminSecurityIncidentDetailPage({ params }: Props) {
  const { incidentId } = await params
  const [detailResult, assigneeResult] = await Promise.all([
    getAdminSecurityIncidentDetail(incidentId),
    listSecurityIncidentAssignees(),
  ])

  if (!detailResult.data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Link href="/admin/security-incidents" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-300"><ArrowLeft className="h-4 w-4" />보안 사건 목록</Link>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-200">{detailResult.error || '보안 사건을 찾을 수 없습니다.'}</div>
        </div>
      </div>
    )
  }

  const { incident, events, sources, auditCorrelationId, sourceTrust } = detailResult.data
  const active = incident.status === 'open' || incident.status === 'acknowledged'

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <Link href="/admin/security-incidents" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-300"><ArrowLeft className="h-4 w-4" />보안 사건 목록</Link>

        <header className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-rose-300"><ShieldAlert className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-widest">Incident Triage</span></div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-xs font-black text-rose-200">{severityLabels[incident.severity]}</span>
                <span className="rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-xs font-black text-indigo-200">{statusLabels[incident.status]}</span>
                <h1 className="text-2xl font-black text-white">{incident.actionKey}</h1>
              </div>
              <p className="mt-3 text-sm text-slate-300">{incident.resourceKey} · {incident.failureCode} · {incident.routeKey}</p>
              <p className="mt-2 break-all text-xs text-slate-600">{incident.fingerprint}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-white">{incident.windowOccurrenceCount.toLocaleString('ko-KR')}회</p>
              <p className="text-xs text-slate-500">최근 60분 · 사건 누적 {incident.lifetimeOccurrenceCount.toLocaleString('ko-KR')}회</p>
              <p className="mt-2 text-xs text-slate-500">최근 감지 {formatDate(incident.lastDetectedAt)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-xs md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4"><p className="font-black text-slate-500">Telemetry 행위자</p><p className="mt-2 text-slate-200">{incident.telemetryActorLabel}</p><p className="mt-1 break-all text-slate-500">{incident.telemetryActorId}</p></div>
            <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4"><p className="font-black text-slate-500">담당자</p><p className="mt-2 text-slate-200">{incident.assigneeLabel || '미배정'}</p><p className="mt-1 break-all text-slate-500">{incident.assignedTo || 'none'}</p></div>
            <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4"><p className="font-black text-slate-500">대상 표본</p><p className="mt-2 break-all text-slate-200">{incident.subjectType}:{incident.latestSubjectRef}</p><p className="mt-1 text-slate-500">최초 {incident.firstSubjectRef}</p></div>
            <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4"><p className="font-black text-slate-500">Workflow</p><p className="mt-2 text-slate-200">version {incident.workflowVersion}</p><p className="mt-1 text-slate-500">alert cooldown {formatDate(incident.alertCooldownUntil)}</p></div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 text-xs leading-relaxed text-amber-100">
            신뢰 수준: {sourceTrust}. 이 화면은 운영 triage용이며 자동 제재나 침해 확정 판단을 수행하지 않습니다.
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/admin/audit?correlation=${encodeURIComponent(auditCorrelationId)}`} className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200">감사 흐름</Link>
            <Link href={`/admin/security-events?actor=${encodeURIComponent(incident.telemetryActorId)}&action=${encodeURIComponent(incident.actionKey)}`} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-slate-300">원본 telemetry</Link>
          </div>
        </header>

        {assigneeResult.error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{assigneeResult.error}</div>}

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
            <h2 className="flex items-center gap-2 text-lg font-black text-white"><UserRoundCog className="h-5 w-5 text-indigo-300" />담당자·확인</h2>
            {active ? (
              <div className="mt-4 space-y-4">
                <form action={assignAdminSecurityIncident} className="space-y-3">
                  <input type="hidden" name="incidentId" value={incident.id} />
                  <input type="hidden" name="workflowVersion" value={incident.workflowVersion} />
                  <select name="assigneeId" defaultValue={incident.assignedTo || ''} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white">
                    <option value="">담당자 해제</option>
                    {assigneeResult.data.map((assignee) => <option key={assignee.userId} value={assignee.userId}>{assignee.displayName}</option>)}
                  </select>
                  <button className="rounded-xl border border-indigo-500/25 bg-indigo-500/15 px-4 py-2.5 text-xs font-black text-indigo-200">담당자 변경</button>
                </form>

                {incident.status === 'open' && (
                  <form action={acknowledgeAdminSecurityIncident}>
                    <input type="hidden" name="incidentId" value={incident.id} />
                    <input type="hidden" name="workflowVersion" value={incident.workflowVersion} />
                    <button className="rounded-xl border border-emerald-500/25 bg-emerald-500/15 px-4 py-2.5 text-xs font-black text-emerald-200">사건 확인 처리</button>
                  </form>
                )}
              </div>
            ) : <p className="mt-4 text-sm text-slate-500">종결된 사건은 담당자와 확인 상태를 변경할 수 없습니다.</p>}
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
            <h2 className="flex items-center gap-2 text-lg font-black text-white"><ClipboardCheck className="h-5 w-5 text-emerald-300" />종결·재개</h2>
            {active ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <form action={resolveAdminSecurityIncident} className="space-y-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4">
                  <input type="hidden" name="incidentId" value={incident.id} /><input type="hidden" name="workflowVersion" value={incident.workflowVersion} /><input type="hidden" name="targetStatus" value="resolved" />
                  <p className="text-sm font-black text-emerald-200">해결 종결</p>
                  <select name="resolutionCode" required className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"><option value="mitigated">조치 완료</option><option value="expected_behavior">정상 동작</option><option value="duplicate">중복 사건</option><option value="insufficient_evidence">근거 부족</option><option value="other">기타</option></select>
                  <textarea name="note" maxLength={2000} placeholder="선택 메모" className="min-h-24 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white" />
                  <button className="rounded-lg border border-emerald-500/25 bg-emerald-500/15 px-4 py-2 text-xs font-black text-emerald-200">해결 처리</button>
                </form>

                <form action={resolveAdminSecurityIncident} className="space-y-3 rounded-xl border border-amber-500/15 bg-amber-500/5 p-4">
                  <input type="hidden" name="incidentId" value={incident.id} /><input type="hidden" name="workflowVersion" value={incident.workflowVersion} /><input type="hidden" name="targetStatus" value="false_positive" />
                  <p className="text-sm font-black text-amber-200">오탐 종결</p>
                  <select name="resolutionCode" required className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"><option value="test_activity">테스트 활동</option><option value="operator_error">운영자 실수</option><option value="telemetry_noise">Telemetry 노이즈</option><option value="expected_behavior">정상 동작</option><option value="other">기타</option></select>
                  <textarea name="note" maxLength={2000} placeholder="선택 메모" className="min-h-24 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white" />
                  <button className="rounded-lg border border-amber-500/25 bg-amber-500/15 px-4 py-2 text-xs font-black text-amber-200">오탐 처리</button>
                </form>
              </div>
            ) : (
              <form action={reopenAdminSecurityIncident} className="mt-4 max-w-xl space-y-3">
                <input type="hidden" name="incidentId" value={incident.id} /><input type="hidden" name="workflowVersion" value={incident.workflowVersion} />
                <select name="reasonCode" required className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"><option value="signal_recurred">신호 재발</option><option value="new_evidence">새 근거</option><option value="incorrect_resolution">잘못된 종결</option><option value="other">기타</option></select>
                <textarea name="note" maxLength={2000} placeholder="선택 메모" className="min-h-24 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
                <button className="rounded-xl border border-rose-500/25 bg-rose-500/15 px-4 py-2.5 text-xs font-black text-rose-200">사건 재개</button>
              </form>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-black text-white"><BellRing className="h-5 w-5 text-rose-300" />대응 이벤트 원장</h2><span className="text-xs text-slate-500">최대 100건</span></div>
          <div className="space-y-3">{events.map((event) => <EventCard key={event.id} event={event} />)}{events.length === 0 && <p className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 text-sm text-slate-500">대응 이벤트가 없습니다.</p>}</div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-black text-white"><RadioTower className="h-5 w-5 text-cyan-300" />연결된 telemetry bucket</h2><span className="text-xs text-slate-500">90일 source retention · 최대 50건</span></div>
          <div className="grid gap-3 lg:grid-cols-2">
            {sources.map((source) => (
              <article key={source.bucketId} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-white">{source.actionKey} · {source.failureCode}</p><p className="mt-1 text-xs text-slate-500">{source.routeKey} · {source.subjectType}:{source.lastSubjectRef}</p><p className="mt-2 text-xs text-slate-500">연결 관측 {source.firstObservedCount} → {source.lastObservedCount}</p></div><p className="text-lg font-black text-white">{source.occurrenceCount}회</p></div>
                <p className="mt-3 text-xs text-slate-600">최근 {formatDate(source.lastSeenAt)} · bucket #{source.bucketId}</p>
              </article>
            ))}
            {sources.length === 0 && <p className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 text-sm text-slate-500">Source bucket이 보존기간 만료로 삭제되었거나 연결 기록이 없습니다. 사건 snapshot과 대응 원장은 유지됩니다.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
