'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ChevronDown,
  ExternalLink,
  Flag,
  Loader2,
  MessageCircle,
  ShieldAlert,
} from 'lucide-react'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationCursor,
  type NotificationPage,
  type NotificationType,
  type UserNotification,
} from '@/lib/actions/notifications'

type Props = {
  initialPage: NotificationPage
  initialError?: string
}

function mergeRows(current: UserNotification[], incoming: UserNotification[]) {
  const rows = new Map(current.map((row) => [row.id, row]))
  for (const row of incoming) rows.set(row.id, row)
  return Array.from(rows.values())
}

function notificationMeta(type: NotificationType) {
  if (type === 'comment_reply') {
    return { label: '새 답글', icon: MessageCircle, tone: 'text-indigo-300', surface: 'border-indigo-500/20 bg-indigo-500/10' }
  }
  if (type === 'comment_report_resolved') {
    return { label: '신고 처리', icon: Flag, tone: 'text-emerald-300', surface: 'border-emerald-500/20 bg-emerald-500/10' }
  }
  if (type === 'comment_author_warning') {
    return { label: '작성자 경고', icon: ShieldAlert, tone: 'text-rose-300', surface: 'border-rose-500/20 bg-rose-500/10' }
  }
  return { label: '댓글 검토', icon: ShieldAlert, tone: 'text-amber-300', surface: 'border-amber-500/20 bg-amber-500/10' }
}

export default function NotificationList({ initialPage, initialError }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState(initialPage.notifications)
  const [nextCursor, setNextCursor] = useState<NotificationCursor | null>(initialPage.nextCursor)
  const [unreadCount, setUnreadCount] = useState(initialPage.unreadCount)
  const [loadingMore, setLoadingMore] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const [error, setError] = useState(initialError || null)
  const [message, setMessage] = useState<string | null>(null)

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return

    setLoadingMore(true)
    setError(null)
    const result = await listNotifications({ cursor: nextCursor, limit: 20 })

    if (result.error) {
      setError(result.error)
      setLoadingMore(false)
      return
    }

    setRows((current) => mergeRows(current, result.data.notifications))
    setNextCursor(result.data.nextCursor)
    setUnreadCount(result.data.unreadCount)
    setLoadingMore(false)
  }

  const markOne = async (row: UserNotification, navigate: boolean) => {
    if (busyId) return

    if (!row.readAt) {
      setBusyId(row.id)
      setError(null)
      setMessage(null)
      const result = await markNotificationRead(row.id)

      if (result.error) {
        setError(result.error)
        setBusyId(null)
        return
      }

      const readAt = result.readAt || new Date().toISOString()
      setRows((current) => current.map((item) => (
        item.id === row.id ? { ...item, readAt } : item
      )))
      setUnreadCount((current) => Math.max(0, current - 1))
      setBusyId(null)
    }

    if (navigate && row.href) router.push(row.href)
  }

  const markAll = async () => {
    if (markingAll || unreadCount === 0) return

    setMarkingAll(true)
    setError(null)
    setMessage(null)
    const result = await markAllNotificationsRead()

    if (result.error) {
      setError(result.error)
      setMarkingAll(false)
      return
    }

    const readAt = new Date().toISOString()
    setRows((current) => current.map((row) => row.readAt ? row : { ...row, readAt }))
    setUnreadCount(0)
    setMessage(`${result.updatedCount || 0}개의 알림을 읽음 처리했습니다.`)
    setMarkingAll(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <BellRing className="h-4 w-4 text-indigo-400" />
          읽지 않은 알림 {unreadCount.toLocaleString('ko-KR')}개
        </div>
        <button
          type="button"
          onClick={() => void markAll()}
          disabled={markingAll || unreadCount === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-[10px] font-bold text-slate-300 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
          모두 읽음
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-200">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] px-5 py-16 text-center">
          <Bell className="mx-auto h-8 w-8 text-slate-700" />
          <p className="mt-3 text-sm font-bold text-slate-400">아직 알림이 없습니다.</p>
          <p className="mt-1 text-xs text-slate-600">답글과 댓글 운영 결과가 이곳에 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const meta = notificationMeta(row.type)
            const Icon = meta.icon
            const unread = !row.readAt
            const busy = busyId === row.id

            return (
              <article
                key={row.id}
                className={`rounded-2xl border p-4 transition sm:p-5 ${
                  unread
                    ? 'border-indigo-500/20 bg-indigo-500/[0.055] shadow-lg shadow-indigo-950/10'
                    : 'border-white/[0.06] bg-white/[0.018]'
                }`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.surface} ${meta.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-black ${meta.tone}`}>{meta.label}</span>
                      {unread && (
                        <span className="rounded-full bg-indigo-400 px-1.5 py-0.5 text-[8px] font-black text-indigo-950">NEW</span>
                      )}
                      <time className="text-[10px] text-slate-600">
                        {new Date(row.createdAt).toLocaleString('ko-KR')}
                      </time>
                    </div>

                    <p className={`mt-2 text-sm leading-relaxed ${unread ? 'font-semibold text-slate-100' : 'text-slate-400'}`}>
                      {row.message}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {row.href ? (
                        <button
                          type="button"
                          onClick={() => void markOne(row, true)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-[10px] font-bold text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                          {unread ? '읽고 내용 보기' : '내용 보기'}
                        </button>
                      ) : unread ? (
                        <button
                          type="button"
                          onClick={() => void markOne(row, false)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-white disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          읽음 처리
                        </button>
                      ) : null}

                      {!row.href && (
                        <span className="text-[9px] text-slate-600">원본 콘텐츠가 삭제되었거나 비공개 상태입니다.</span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {nextCursor && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-2 text-xs font-bold text-slate-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
            알림 더 보기
          </button>
        </div>
      )}
    </div>
  )
}
