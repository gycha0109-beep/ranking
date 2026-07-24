import Link from 'next/link'
import { ArrowLeft, ClipboardCheck, LockKeyhole, ShieldCheck } from 'lucide-react'
import {
  getAdminAuditEventDetail,
  type AdminAuditEvent,
  type AdminAuditEventKind,
} from '@/lib/actions/admin-access'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ eventKind: string; eventId: string }>
}

const kindLabels: Record<AdminAuditEventKind, string> = {
  role_change: '역할 변경',
  moderation_review: 'Moderation',
  comment_report_decision: '댓글 신고 결정',
  sanction_event: '사용자 제재',
  appeal_decision: '이의제기 결정',
  maintenance_job: '유지보수 작업',
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR')
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return '없음'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value, null, 2)
}

function EvidenceGrid({ evidence }: { evidence: Record<string, unknown> }) {
  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {Object.entries(evidence).map(([key, value]) => (
        <div key={key} className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">{key}</dt>
          <dd className="mt-2 whitespace-pre-wrap break-all text-sm text-slate-200">{formatValue(value)}</dd>
        </div>
      ))}
      {Object.keys(evidence).length === 0 && <p className="text-sm text-slate-500">표시할 근거가 없습니다.</p>}
    </dl>
  )
}

function RelatedEvent({ event }: { event: AdminAuditEvent }) {
  return (
    <Link href={`/admin/audit/${encodeURIComponent(event.eventKind)}/${encodeURIComponent(event.eventId)}`} className="block rounded-xl border border-white/[0.07] bg-black/20 p-4 transition hover:border-indigo-500/30 hover:bg-white/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">{kindLabels[event.eventKind]} · {event.action}</p>
          <p className="mt-1 text-sm text-slate-400">{event.summary}</p>
          <p className="mt-2 text-xs text-slate-500">{event.actorLabel} → {event.subjectLabel}</p>
        </div>
        <time className="text-xs text-slate-500">{formatDate(event.createdAt)}</time>
      </div>
    </Link>
  )
}

export default async function AdminAuditDetailPage({ params }: Props) {
  const { eventKind, eventId } = await params
  const result = await getAdminAuditEventDetail(eventKind, eventId)

  if (!result.data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Link href="/admin/audit" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-300"><ArrowLeft className="h-4 w-4" />감사 목록</Link>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-200">{result.error || '감사 이벤트를 찾을 수 없습니다.'}</div>
        </div>
      </div>
    )
  }

  const { event, evidence, sensitiveEvidence, relatedEvents, canViewSensitive } = result.data

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <Link href={`/admin/audit?correlation=${encodeURIComponent(event.correlationId)}`} className="inline-flex items-center gap-2 text-sm font-bold text-indigo-300"><ArrowLeft className="h-4 w-4" />같은 사건 목록</Link>
        </div>

        <header className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-300"><ClipboardCheck className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-widest">Audit Evidence</span></div>
              <h1 className="mt-2 text-3xl font-black text-white">{kindLabels[event.eventKind]} · {event.action}</h1>
              <p className="mt-3 text-sm text-slate-300">{event.summary}</p>
            </div>
            <time className="text-xs text-slate-500">{formatDate(event.createdAt)}</time>
          </div>

          <div className="mt-5 grid gap-3 text-xs md:grid-cols-2">
            <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4"><p className="font-black text-slate-500">행위자</p><p className="mt-2 text-slate-200">{event.actorLabel}</p><p className="mt-1 break-all text-slate-500">{event.actorId || 'system'}</p></div>
            <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4"><p className="font-black text-slate-500">대상</p><p className="mt-2 text-slate-200">{event.subjectLabel}</p><p className="mt-1 break-all text-slate-500">{event.subjectId || event.subjectType}</p></div>
            <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4"><p className="font-black text-cyan-400">Correlation</p><p className="mt-2 break-all text-cyan-200">{event.correlationId}</p></div>
            <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/5 p-4"><p className="font-black text-indigo-400">Group</p><p className="mt-2 break-all text-indigo-200">{event.groupId}</p></div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={event.sourceHref} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-slate-300">원본 운영 화면</Link>
            <Link href="/admin/audit" className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-slate-300">전체 감사 목록</Link>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-black text-white"><ShieldCheck className="h-5 w-5 text-emerald-300" />비민감 결정 근거</h2>
          <EvidenceGrid evidence={evidence} />
        </section>

        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-black text-white"><LockKeyhole className="h-5 w-5 text-amber-300" />민감 운영 근거</h2>
          {canViewSensitive && sensitiveEvidence ? (
            <EvidenceGrid evidence={sensitiveEvidence} />
          ) : (
            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-5 text-sm text-amber-100">최고 관리자 전용 근거입니다. 일반 감사 조회에는 자유서술 운영 메모가 포함되지 않습니다.</div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black text-white">동일 사건 관련 이벤트</h2>
            <span className="text-xs text-slate-500">최대 50건 · {event.correlationId}</span>
          </div>
          <div className="space-y-3">
            {relatedEvents.map((relatedEvent) => <RelatedEvent key={`${relatedEvent.eventKind}:${relatedEvent.eventId}`} event={relatedEvent} />)}
            {relatedEvents.length === 0 && <p className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 text-sm text-slate-500">관련 이벤트가 없습니다.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
