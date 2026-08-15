import React from 'react'
import Link from 'next/link'
import { getVisibleCategories } from '@/lib/queries/public'
import { ChevronRight, Compass, FolderOpen, Inbox } from 'lucide-react'

export const revalidate = 0

export default async function CategoriesPage() {
  const categories = await getVisibleCategories()

  return (
    <div className="rw-page pb-20">
      <header className="border-b border-[#e3e7ec] bg-white">
        <div className="rw-container py-10 sm:py-12">
          <p className="rw-kicker flex items-center gap-2"><Compass className="h-4 w-4" /> Topics</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#171a1f] sm:text-4xl">카테고리</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[#6b7280]">대분류에서 시작해 세부 주제로 좁히고, 해당 분야의 공개 랭킹을 확인합니다.</p>
        </div>
      </header>

      <div className="rw-container pt-8 sm:pt-10">
        {categories.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {categories.map((cat) => (
              <article key={cat.id} className="rw-surface rw-card p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0f2f5] text-[#667085]">
                      <FolderOpen className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <Link href={`/categories/${cat.slug}`} className="group inline-flex items-center gap-1.5">
                        <h2 className="text-lg font-black tracking-[-0.025em] text-[#20242a] transition group-hover:text-[#2445ad]">{cat.name}</h2>
                        <ChevronRight className="h-4 w-4 text-[#a4acb7] transition group-hover:translate-x-0.5 group-hover:text-[#3457c8]" />
                      </Link>
                      <p className="mt-2 text-xs leading-6 text-[#6b7280]">{cat.description || '이 카테고리의 공개 랭킹과 세부 주제를 확인합니다.'}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-[#edf0f3] pt-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#9aa3af]">세부 카테고리</p>
                  {cat.subcategories && cat.subcategories.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {cat.subcategories.map((sub: any) => (
                        <Link
                          key={sub.id}
                          href={`/categories/${cat.slug}/${sub.slug}`}
                          className="rounded-lg border border-[#dfe4ea] bg-[#fafbfc] px-3 py-1.5 text-xs font-bold text-[#5f6875] transition hover:border-[#b9c5dc] hover:bg-[#eef2ff] hover:text-[#2445ad]"
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-[#a0a8b3]">등록된 세부 카테고리가 없습니다.</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rw-surface rw-card flex flex-col items-center justify-center px-6 py-16 text-center">
            <Inbox className="h-7 w-7 text-[#a4acb7]" />
            <h3 className="mt-4 text-sm font-extrabold text-[#3f4752]">카테고리가 비어 있습니다</h3>
            <p className="mt-2 text-xs text-[#8a94a3]">공개 카테고리가 등록되면 이곳에 표시됩니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}
