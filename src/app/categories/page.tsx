import React from 'react'
import Link from 'next/link'
import { getVisibleCategories } from '@/lib/queries/public'
import { ArrowUpRight, Compass, Inbox } from 'lucide-react'

export const revalidate = 0

export default async function CategoriesPage() {
  const categories = await getVisibleCategories()

  return (
    <div className="rw-page bg-white pb-20">
      <header className="border-b border-[#e3e7ec] bg-white">
        <div className="rw-container py-10 sm:py-14 lg:py-16">
          <p className="rw-kicker flex items-center gap-2"><Compass className="h-4 w-4" aria-hidden="true" /> Explore by topic</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
            <h1 className="rw-display max-w-3xl text-[2.7rem] font-black leading-[1.02] tracking-[-0.055em] text-[#111318] sm:text-[4rem] lg:text-[4.8rem]">
              관심 분야부터<br />랭킹을 골라보세요.
            </h1>
            <p className="max-w-md text-sm font-medium leading-7 text-[#626b77] lg:pb-2">
              대분류에서 시작해 세부 주제로 좁혀가며, 지금 공개된 랭킹 컬렉션을 한눈에 탐색합니다.
            </p>
          </div>
        </div>
      </header>

      <div className="rw-container pt-8 sm:pt-10">
        {categories.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {categories.map((cat, index) => {
              const sequence = String(index + 1).padStart(2, '0')
              const initials = cat.name.trim().slice(0, 2) || 'RW'

              return (
                <article key={cat.id} className="group overflow-hidden rounded-[18px] border border-[#dfe3e8] bg-white transition hover:-translate-y-0.5 hover:border-[#c8d3e7] hover:shadow-[0_18px_42px_rgba(17,24,39,0.08)]">
                  <Link href={`/categories/${cat.slug}`} className="relative block min-h-[238px] overflow-hidden bg-[#111827] p-6 text-white sm:p-7">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(65,105,225,0.95),transparent_34%),linear-gradient(135deg,#10131a_0%,#1f2937_52%,#1d4ed8_100%)]" />
                    <span className="absolute -bottom-5 right-3 text-[7.5rem] font-black leading-none tracking-[-0.09em] text-white/[0.07] sm:text-[9rem]">{initials}</span>

                    <div className="relative z-10 flex min-h-[190px] flex-col">
                      <div className="flex items-center justify-between gap-4">
                        <span className="rw-rank-number text-sm font-black tracking-[-0.03em] text-white/55">{sequence}</span>
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 transition group-hover:bg-white group-hover:text-[#172033]">
                          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </div>

                      <div className="mt-auto pt-12">
                        <p className="text-[10px] font-black uppercase tracking-[0.13em] text-white/55">Ranking collection</p>
                        <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-[2.15rem]">{cat.name}</h2>
                        <p className="mt-3 max-w-lg text-xs font-medium leading-6 text-white/70">{cat.description || '이 카테고리의 공개 랭킹과 세부 주제를 확인합니다.'}</p>
                      </div>
                    </div>
                  </Link>

                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8a94a3]">세부 카테고리</p>
                      <span className="text-[10px] font-bold text-[#9aa3af]">{cat.subcategories?.length || 0}개 주제</span>
                    </div>

                    {cat.subcategories && cat.subcategories.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {cat.subcategories.map((sub: any) => (
                          <Link
                            key={sub.id}
                            href={`/categories/${cat.slug}/${sub.slug}`}
                            className="rounded-full border border-[#dfe4ea] bg-[#fafbfc] px-3 py-1.5 text-xs font-bold text-[#5f6875] transition hover:border-[#aebfe9] hover:bg-[#eff4ff] hover:text-[#1d4ed8]"
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
              )
            })}
          </div>
        ) : (
          <div className="rw-surface rw-card flex flex-col items-center justify-center px-6 py-16 text-center">
            <Inbox className="h-7 w-7 text-[#a4acb7]" aria-hidden="true" />
            <h3 className="mt-4 text-sm font-extrabold text-[#3f4752]">카테고리가 비어 있습니다</h3>
            <p className="mt-2 text-xs text-[#8a94a3]">공개 카테고리가 등록되면 이곳에 표시됩니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}
