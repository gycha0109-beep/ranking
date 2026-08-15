'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bookmark, Eye, Heart, Loader2 } from 'lucide-react'
import { getEngagementTargetByPath, recordContentView, setContentBookmark, setContentLike } from '@/lib/actions/engagement'

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
      setTarget(current => current?.id === targetId ? { ...current, uniqueViewCount: result.uniqueViewCount ?? current.uniqueViewCount } : current)
    }
    void record()
    return () => { active = false }
  }, [pathname, target?.id, target?.type])

  if (!pathname.match(/^\/(rankings|items)\/[^/]+$/)) return null
  if (loading) {
    return <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-[#dde2e8] bg-white p-3 text-[#8a94a3] shadow-lg"><Loader2 className="h-4 w-4 animate-spin" /></div>
  }
  if (!target) return null

  const requireLogin = () => router.push(`/login?next=${encodeURIComponent(pathname)}`)

  const handleLike = () => {
    if (!target.authenticated) return requireLogin()
    const previous = target
    const nextLiked = !target.liked
    setMessage(null)
    setTarget({ ...target, liked: nextLiked, likeCount: Math.max(0, target.likeCount + (nextLiked ? 1 : -1)) })
    startLikeTransition(async () => {
      const result = await setContentLike({ targetType: target.type, targetId: target.id, liked: nextLiked, pathname })
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
      setTarget(current => current ? { ...current, liked: result.liked ?? nextLiked, likeCount: result.likeCount ?? current.likeCount } : current)
    })
  }

  const handleBookmark = () => {
    if (!target.authenticated) return requireLogin()
    const previous = target
    const nextBookmarked = !target.bookmarked
    setMessage(null)
    setTarget({ ...target, bookmarked: nextBookmarked })
    startBookmarkTransition(async () => {
      const result = await setContentBookmark({ targetType: target.type, targetId: target.id, bookmarked: nextBookmarked, pathname })
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
      setTarget(current => current ? { ...current, bookmarked: result.bookmarked ?? nextBookmarked } : current)
    })
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:bottom-5 sm:right-5">
      {message && <div className="mb-2 rounded-xl border border-[#efc2ca] bg-[#fff1f2] px-3 py-2 text-[10px] font-semibold text-[#a93449] shadow-lg">{message}</div>}
      <div className="mx-auto flex max-w-md items-center justify-between gap-1 rounded-2xl border border-[#d8dee6] bg-white/95 p-1.5 shadow-[0_16px_45px_rgba(20,30,50,0.16)] backdrop-blur-xl sm:max-w-none">
        <div className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[#6b7280]" title="일일 중복을 제거한 누적 조회수">
          <Eye className="h-4 w-4" />
          <span className="text-[11px] font-bold">{target.uniqueViewCount.toLocaleString('ko-KR')}</span>
        </div>

        <button
          type="button"
          onClick={handleLike}
          disabled={isLikePending || isBookmarkPending}
          aria-pressed={target.liked}
          aria-label={`${target.title} 좋아요 ${target.liked ? '취소' : '추가'}`}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-extrabold transition disabled:cursor-wait disabled:opacity-60 ${target.liked ? 'bg-[#fff1f2] text-[#be4057]' : 'text-[#5f6875] hover:bg-[#f6f7f9] hover:text-[#be4057]'}`}
        >
          {isLikePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${target.liked ? 'fill-current' : ''}`} />}
          좋아요 <span className="text-[10px] opacity-70">{target.likeCount.toLocaleString('ko-KR')}</span>
        </button>

        <button
          type="button"
          onClick={handleBookmark}
          disabled={isLikePending || isBookmarkPending}
          aria-pressed={target.bookmarked}
          aria-label={`${target.title} 북마크 ${target.bookmarked ? '취소' : '추가'}`}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-extrabold transition disabled:cursor-wait disabled:opacity-60 ${target.bookmarked ? 'bg-[#eef2ff] text-[#3457c8]' : 'text-[#5f6875] hover:bg-[#f6f7f9] hover:text-[#2445ad]'}`}
        >
          {isBookmarkPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className={`h-4 w-4 ${target.bookmarked ? 'fill-current' : ''}`} />}
          {target.bookmarked ? '저장됨' : '저장'}
        </button>
      </div>
    </div>
  )
}
