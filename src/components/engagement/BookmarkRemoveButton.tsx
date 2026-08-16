'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookmarkX, Loader2 } from 'lucide-react'
import { setContentBookmark } from '@/lib/actions/engagement'

type Props = {
  targetType: 'ranking' | 'item'
  targetId: string
  pathname: string
  title: string
}

export default function BookmarkRemoveButton({ targetType, targetId, pathname, title }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const remove = () => {
    setError(null)
    startTransition(async () => {
      const result = await setContentBookmark({
        targetType,
        targetId,
        bookmarked: false,
        pathname,
      })

      if (result.error === 'AUTH_REQUIRED') {
        router.push(`/login?next=${encodeURIComponent('/me/bookmarks')}`)
        return
      }

      if (result.error) {
        setError('북마크를 제거하지 못했습니다.')
        return
      }

      router.refresh()
    })
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label={`${title} 북마크 제거`}
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] font-bold text-slate-400 transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkX className="h-3.5 w-3.5" />}
        저장 해제
      </button>
      {error && <p className="text-[10px] font-semibold text-rose-300">{error}</p>}
    </div>
  )
}
