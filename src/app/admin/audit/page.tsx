import Link from 'next/link'
import { ClipboardList, Filter, Search } from 'lucide-react'
import {
  ADMIN_AUDIT_EVENT_KINDS,
  listAdminAuditEventsV2,
  type AdminAuditEventKind,
} from '@/lib/actions/admin-access'

export const dynamic = 'force-dynamic'

type AuditSearchParams = {
  kind?: string | string[]
  actor?: string
  subject?: string
  correlation?: string
  from?: string
  to?: string
  cursorAt?: string
  cursorKey?: string
}

type Props = { searchParams: Promise<AuditSearchParams> }

const kindLabels: Record<AdminAuditEventKind, string> = {
  role_change: '역할 변경',
  moderation_review: 'Moderation',
  comment_report_decision: '댓글 신고 결정',
  sanction_event: '사용자 제재',
  appeal_decision: '이의제기 결정',
  maintenance_job: '유지보수 작업',
}

function normalizeDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00+09:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function toRangeStart(value?: string) {
  return normalizeDate(value)?.toISOString() || null
}

function toRangeEnd(value?: string) {
  const date = normalizeDate(value)
  if (!date) return null
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString()
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR')
}

function buildSearchUrl(params: AuditSearchParams, cursor?: { createdAt: string; sortKey: string } | null) {
  const query = new URLSearchParams()
  const kinds = Array.isArray(params.kind) ? params.kind : params.kind ? [params.kind] : []
  kinds.forEach((kind) => query.append('kind', kind))
  if (params.actor) query.set('actor', params.actor)
  if (params.subject) query.set('subject', params.subject)
  if (params.correlation) query.set('correlation', params.correlation)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (cursor) {
    query.set('cursorAt', cursor.createdAt)
    query.set('cursorKey', cursor.sortKey)
  }
  const serialized = query.toString()
  return serialized ? `/admin/audit?${serialized}` : '/admin/audit'
}

export default async function AdminAuditPage({ searchParams }: Props) {
  const params = await searchParams
  const rawKinds = Array.isArray(params.kind) ? params.kind : params.kind ? [params.kind] : []
  const eventKinds = rawKinds.filter((kind): kind is AdminAuditEventKind => (
    ADMIN_AUDIT_EVENT_KINDS as readonly string[]
  ).includes(kind))

  const result = await listAdminAuditEventsV2({
    eventKinds,
    actorId: params.actor,
    subjectId: params.subject,
    correlationId: params.correlation,
    from: toRangeStart(params.from),
    to: toRangeEnd(params.to),
    cursor: params.cursorAt && params.cursorKey
      ? { createdAt: params.cursorAt, sortKey: params.cursorKey }
      : null,
    limit: 50,
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-2 text-emerald-300">
            <ClipboardList className="h-5 w-5" />
            <span className="text-xs font-black uppercase tracking-widest">Operator Audit</span>
          </div>
          <h1 className="mt-2 text-3xl font-black text-white">운영 감사 상관관계 탐색</h1>
          <p className="mt-2 text-sm text-slate-500">행위자·대상·결정 근거와 같은 사건의 후속 제재·이의제기를 안정적인 cursor로 추적합니다.</p>
        </header>

        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-black text-white">
            <Filter className="h-4 w-4 text-indigo-300" /> 감사 필터
          </div>
          <form className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-xs font-bold text-slate-400">이벤트 종류</legend>
              <div className="flex flex-wrap gap-2">
                {ADMIN_AUDIT_EVENT_KINDS.map((kind) => (
                  <label key={kind} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                    <input type="checkbox" name="kind" value={kind} defaultChecked={eventKinds.includes(kind)} />
                    {kindLabels[kind]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1 text-xs text-slate-400">
                <span>행위자 UUID</span>
                <input name="actor" defaultValue={params.actor || ''} placeholder="operator UUID" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                <span>대상 UUID</span>
                <input name="subject" defaultValue={params.subject || ''} placeholder="user / entity UUID" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
              </label>
              <label className="space-y-1 text-xs text-slate-400 md:col-span-2">
                <span>Correlation ID</span>
                <input name="correlation" defaultValue={params.correlation || ''} placeholder="comment:... / sanction:... / maintenance:..." className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                <span>시작일</span>
                <input type="date" name="from" defaultValue={params.from || ''} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                <span>종료일</span>
                <input type="date" name="to" defaultValue={params.to || ''} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/15 px-5 py-2.5 text-xs font-black text-indigo-200">
                <Search className="h-4 w-4" /> 조회
              </button>
              <Link href="/admin/audit" className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-xs font-black text-slate-300">초기화</Link>
            </div>
          </form>
        </section>

        {result.error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{result.error}</div>
        )}

        <section className="space-y-3">
          {result.data.map((event) => (
            <article key={`${event.eventKind}:${event.eventId}`} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-200">{kindLabels[event.eventKind]}</span>
                    <span className="font-black text-white">{event.action}</span>
                    {event.reasonCode && <span className="text-xs text-slate-500">{event.reasonCode}</span>}
                  </div>
                  <p className="text-sm text-slate-300">{event.summary}</p>
                  <div className="space-y-1 text-xs text-slate-500">
                    <p>행위자 {event.actorLabel} · {event.actorId || 'system'}</p>
                    <p>대상 {event.subjectLabel} · {event.subjectId || event.subjectType}</p>
                  </div>
                </div>
                <time className="shrink-0 text-xs text-slate-500">{formatDate(event.createdAt)}</time>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <Link href={`/admin/audit?correlation=${encodeURIComponent(event.correlationId)}`} className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 font-bold text-cyan-200">
                  사건 {event.correlationId}
                </Link>
                <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-slate-400">그룹 {event.groupId}</span>
                <Link href={`/admin/audit/${encodeURIComponent(event.eventKind)}/${encodeURIComponent(event.eventId)}`} className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 font-bold text-indigo-200">근거 상세</Link>
                <Link href={event.sourceHref} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-bold text-slate-300">원본 운영 화면</Link>
              </div>
            </article>
          ))}

          {result.data.length === 0 && !result.error && (
            <p className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-8 text-center text-sm text-slate-500">조건에 맞는 감사 기록이 없습니다.</p>
          )}
        </section>

        {result.nextCursor && (
          <div className="flex justify-center">
            <Link href={buildSearchUrl(params, result.nextCursor)} className="rounded-xl border border-indigo-500/25 bg-indigo-500/15 px-6 py-3 text-sm font-black text-indigo-200">다음 기록</Link>
          </div>
        )}
      </div>
    </div>
  )
}
