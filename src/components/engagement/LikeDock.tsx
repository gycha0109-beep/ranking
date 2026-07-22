'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bookmark, Eye, Heart, Loader2 } from 'lucide-react'
import {
  getEngagementTargetByPath,
  recordContentView,
  setContentBookmark,
  setContentLike,
} from '@/lib/actions/engagement'

type EngagementTarget = {
  type: 'ranking' | 'item'
  id: string
  title: string
  liked: boolean
  likeCount: number
  bookmarked: boolean
  authenticated: boolean
  uniqueViewCount: number
}

export default function LikeDock() {
  const pathname = usePathname()
  const router = useRouter()
  const [target, setTarget] = useState<EngagementTarget | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isLikePending, startLikeTransition] = useTransition()
  const [isBookmarkPending, startBookmarkTransition] = useTransition()

  useEffect(() => {
    let active = true
    setTarget(null)
    setMessage(null)

    const load = async () => {
      setLoading(true)
      const result = await getEngagementTargetByPath(pathname)
      if (active) {
        setTarget((result.target as EngagementTarget | null) || null)
        setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [pathname])

  useEffect(() => {
    if (!target) return

    let active = true
    const targetId = target.id
    const targetType = target.type

    const record = async () => {
      const result = await recordContentView({ targetType, targetId, pathname })
      if (!active || !result.success || result.uniqueViewCount === undefined) return

      setTarget(current => current?.id === targetId
        ? { ...current, uniqueViewCount: result.uniqueViewCount ?? current.uniqueViewCount }
        : current)
    }

    void record()
    return () => { active = false }
  }, [pathname, target?.id, target?.type])

  if (!pathname.match(/^\/(rankings|items)\/[^/]+$/)) return null
  if (loading) {
    return (
      <div className="fixed bottom-5 right-5 z-50 rounded-2xl border border-white/10 bg-[#101017]/95 p-3 text-slate-400 shadow-2xl backdrop-blur-xl">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }
  if (!target) return null

  const requireLogin = () => {
    router.push(`/login?next=${encodeURIComponent(pathname)}`)
  }

  const handleLike = () => {
    if (!target.authenticated) {
      requireLogin()
      return
    }

    const previous = target
    const nextLiked = !target.liked
    setMessage(null)
    setTarget({ ...target, liked: nextLiked, likeCount: Math.max(0, target.likeCount + (nextLiked ? 1 : -1)) })

    startLikeTransition(async () => {
      const result = await setContentLike({
        targetType: target.type,
        targetId: target.id,
        liked: nextLiked,
        pathname,
      })

      if (result.error === 'AUTH_REQUIRED') {
        setTarget(previous)
        requireLogin()
        return
      }
      if (result.error) {
        setTarget(previous)
        setMessage(result.error)
        return
      }

      setTarget(current => current ? {
        ...current,
        liked: result.liked ?? nextLiked,
        likeCount: result.likeCount ?? current.likeCount,
      } : current)
    })
  }

  const handleBookmark = () => {
    if (!target.authenticated) {
      requireLogin()
      return
    }

    const previous = target
    const nextBookmarked = !target.bookmarked
    setMessage(null)
    setTarget({ ...target, bookmarked: nextBookmarked })

    startBookmarkTransition(async () => {
      const result = await setContentBookmark({
        targetType: target.type,
        targetId: target.id,
        bookmarked: nextBookmarked,
        pathname,
      })

      if (result.error === 'AUTH_REQUIRED') {
        setTarget(previous)
        requireLogin()
        return
      }
      if (result.error) {
        setTarget(previous)
        setMessage(result.error)
        return
      }

      setTarget(current => current ? {
        ...current,
        bookmarked: result.bookmarked ?? nextBookmarked,
      } : current)
    })
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-[calc(100vw-2.5rem)]">
      {message && (
        <div className="mb-2 rounded-xl border border-rose-500/20 bg-rose-950/95 px-3 py-2 text-[10px] text-rose-200 shadow-xl">
          {message}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-white/10 bg-[#101017]/95 p-2 shadow-2xl backdrop-blur-xl">
        <div
          className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-slate-300"
          aria-label={`${target.title} 일일 고유 조회 누적 ${target.uniqueViewCount}회`}
          title="일일 중복을 제거한 누적 조회수"
        >
          <Eye className="h-4 w-4 text-cyan-300" />
          <span className="text-left">
            <span className="block text-xs font-bold">조회</span>
            <span className="block text-[10px] text-slate-400">{target.uniqueViewCount.toLocaleString('ko-KR')}회</span>
          </span>
        </div>

        <button
          type="button"
          onClick={handleLike}
          disabled={isLikePending || isBookmarkPending}
          aria-pressed={target.liked}
          aria-label={`${target.title} 좋아요 ${target.liked ? '취소' : '추가'}`}
          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all disabled:cursor-wait disabled:opacity-70 ${
            target.liked
              ? 'border-rose-400/30 bg-rose-500/20 text-rose-100'
              : 'border-white/5 bg-white/[0.02] text-slate-200 hover:border-rose-400/25 hover:bg-rose-500/10'
          }`}
        >
          {isLikePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${target.liked ? 'fill-current text-rose-400' : 'text-slate-400'}`} />}
          <span className="text-left">
            <span className="block text-xs font-bold">{target.liked ? '좋아요 완료' : '좋아요'}</span>
            <span className="block text-[10px] text-slate-400">{target.likeCount.toLocaleString('ko-KR')}명</span>
          </span>
        </button>

        <button
          type="button"
          onClick={handleBookmark}
          disabled={isLikePending || isBookmarkPending}
          aria-pressed={target.bookmarked}
          aria-label={`${target.title} 북마크 ${target.bookmarked ? '취소' : '추가'}`}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all disabled:cursor-wait disabled:opacity-70 ${
            target.bookmarked
              ? 'border-indigo-400/30 bg-indigo-500/20 text-indigo-100'
              : 'border-white/5 bg-white/[0.02] text-slate-300 hover:border-indigo-400/25 hover:bg-indigo-500/10'
          }`}
        >
          {isBookmarkPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className={`h-4 w-4 ${target.bookmarked ? 'fill-current text-indigo-300' : 'text-slate-400'}`} />}
          {target.bookmarked ? '저장됨' : '북마크'}
        </button>
      </div>
    </div>
  )
}
