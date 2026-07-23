'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type NotificationType =
  | 'comment_reply'
  | 'comment_moderation_changed'
  | 'comment_report_resolved'
  | 'comment_author_warning'

export type NotificationCursor = {
  createdAt: string
  id: string
}

export type UserNotification = {
  id: string
  type: NotificationType
  eventValue: string | null
  message: string
  href: string | null
  actor: {
    displayName: string | null
    avatarUrl: string | null
  }
  createdAt: string
  readAt: string | null
}

export type NotificationPage = {
  notifications: UserNotification[]
  nextCursor: NotificationCursor | null
  unreadCount: number
}

type MutationResult = {
  success?: true
  readAt?: string
  updatedCount?: number
  error?: string
  code?: 'AUTH_REQUIRED' | 'INVALID_INPUT' | 'NOT_FOUND' | 'UNKNOWN'
}

function parseCount(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function parseType(value: unknown): NotificationType | null {
  if (
    value === 'comment_reply'
    || value === 'comment_moderation_changed'
    || value === 'comment_report_resolved'
    || value === 'comment_author_warning'
  ) return value

  return null
}

function mapNotificationRow(raw: unknown): UserNotification | null {
  const row = raw as Record<string, unknown>
  const type = parseType(row.notification_type)

  if (
    typeof row.notification_id !== 'string'
    || !type
    || typeof row.message !== 'string'
    || typeof row.created_at !== 'string'
  ) return null

  return {
    id: row.notification_id,
    type,
    eventValue: typeof row.event_value === 'string' ? row.event_value : null,
    message: row.message,
    href: typeof row.href === 'string' ? row.href : null,
    actor: {
      displayName: typeof row.actor_display_name === 'string' ? row.actor_display_name : null,
      avatarUrl: typeof row.actor_avatar_url === 'string' ? row.actor_avatar_url : null,
    },
    createdAt: row.created_at,
    readAt: typeof row.read_at === 'string' ? row.read_at : null,
  }
}

function mapMutationError(error: { code?: string | null; message?: string | null }): MutationResult {
  const message = error.message || '알림 요청을 처리하지 못했습니다.'

  if (error.code === '42501') {
    return { error: '로그인이 필요합니다.', code: 'AUTH_REQUIRED' }
  }
  if (error.code === '22023') {
    return { error: message, code: 'INVALID_INPUT' }
  }
  if (error.code === 'P0002') {
    return { error: message, code: 'NOT_FOUND' }
  }

  return { error: message, code: 'UNKNOWN' }
}

export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 0

    const { data, error } = await supabase.rpc('get_my_unread_notification_count')
    if (error) return 0
    return parseCount(data)
  } catch {
    return 0
  }
}

export async function listNotifications(input?: {
  cursor?: NotificationCursor | null
  limit?: number
}): Promise<{ data: NotificationPage; error?: string }> {
  const empty: NotificationPage = { notifications: [], nextCursor: null, unreadCount: 0 }

  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { data: empty, error: '로그인이 필요합니다.' }

    const pageSize = Math.min(Math.max(input?.limit || 20, 1), 50)
    const [listResult, countResult] = await Promise.all([
      supabase.rpc('list_my_notifications', {
        p_cursor_created_at: input?.cursor?.createdAt || null,
        p_cursor_id: input?.cursor?.id || null,
        p_limit: pageSize + 1,
      }),
      supabase.rpc('get_my_unread_notification_count'),
    ])

    if (listResult.error) return { data: empty, error: listResult.error.message }
    if (countResult.error) return { data: empty, error: countResult.error.message }

    const parsedRows = (Array.isArray(listResult.data) ? listResult.data : [])
      .map(mapNotificationRow)
      .filter((row): row is UserNotification => Boolean(row))

    const hasMore = parsedRows.length > pageSize
    const notifications = hasMore ? parsedRows.slice(0, pageSize) : parsedRows
    const last = notifications.at(-1)

    return {
      data: {
        notifications,
        nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
        unreadCount: parseCount(countResult.data),
      },
    }
  } catch (error) {
    return {
      data: empty,
      error: error instanceof Error ? error.message : '알림을 불러오지 못했습니다.',
    }
  }
}

export async function markNotificationRead(notificationId: string): Promise<MutationResult> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: '로그인이 필요합니다.', code: 'AUTH_REQUIRED' }

    const { data, error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: notificationId,
    })

    if (error) return mapMutationError(error)

    const value = (data || {}) as { read_at?: unknown }
    revalidatePath('/me/notifications')
    revalidatePath('/', 'layout')

    return {
      success: true,
      readAt: typeof value.read_at === 'string' ? value.read_at : new Date().toISOString(),
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : '알림을 읽음 처리하지 못했습니다.',
      code: 'UNKNOWN',
    }
  }
}

export async function markAllNotificationsRead(): Promise<MutationResult> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: '로그인이 필요합니다.', code: 'AUTH_REQUIRED' }

    const { data, error } = await supabase.rpc('mark_all_notifications_read')
    if (error) return mapMutationError(error)

    revalidatePath('/me/notifications')
    revalidatePath('/', 'layout')

    return {
      success: true,
      updatedCount: parseCount(data),
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : '알림을 모두 읽음 처리하지 못했습니다.',
      code: 'UNKNOWN',
    }
  }
}
