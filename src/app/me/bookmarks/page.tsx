import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bookmark, Layers } from 'lucide-react'
import SafeImage from '@/components/SafeImage'
import BookmarkRemoveButton from '@/components/engagement/BookmarkRemoveButton'
import { listMyBookmarks } from '@/lib/actions/engagement'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function BookmarksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=%2Fme%2Fbookmarks')

  const bookmarks = await listMyBookmarks()

  return (
    <div className="min-h-screen bg-[#07070a] px-4 py-12 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-300">
            <Bookmark className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">My Library</span>
          </div>
          <h1 className="text-3xl font-black">내 북마크</h1>
          <p className="text-sm text-slate-400">저장한 랭킹과 아이템은 본인에게만 표시됩니다.</p>
        </div>

        {bookmarks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-16 text-center">
            <Bookmark className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-4 text-sm font-semibold text-slate-300">저장한 콘텐츠가 없습니다.</p>
            <p className="mt-1 text-xs text-slate-500">랭킹이나 아이템 상세 페이지에서 북마크를 추가해 주세요.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {bookmarks.map((bookmark) => {
              const href = bookmark.targetType === 'ranking'
                ? `/rankings/${bookmark.slug}`
                : `/items/${bookmark.slug}`

              return (
                <article
                  key={`${bookmark.targetType}-${bookmark.targetId}`}
                  className="group overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] transition-all hover:border-indigo-500/25 hover:bg-white/[0.04]"
                >
                  <Link href={href} className="block">
                    <div className="aspect-[16/8] overflow-hidden bg-slate-900/60">
                      {bookmark.imageUrl ? (
                        <SafeImage
                          src={bookmark.imageUrl}
                          alt={bookmark.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          fallbackSrc="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Layers className="h-8 w-8 text-slate-700" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 p-5 pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-indigo-300">
                          {bookmark.targetType === 'ranking' ? 'Ranking' : 'Item'}
                        </span>
                        <span className="text-[10px] text-slate-600">
                          {new Date(bookmark.bookmarkedAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-slate-100 transition-colors group-hover:text-indigo-300">
                        {bookmark.title}
                      </h2>
                      {bookmark.summary && (
                        <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
                          {bookmark.summary}
                        </p>
                      )}
                    </div>
                  </Link>
                  <div className="px-5 pb-5">
                    <BookmarkRemoveButton
                      targetType={bookmark.targetType}
                      targetId={bookmark.targetId}
                      pathname={href}
                      title={bookmark.title}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
