import React from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, CalendarDays, Database, FileText, ShieldCheck } from 'lucide-react'
import SearchForm from '@/components/SearchForm'
import { getHomeData } from '@/lib/queries/public'
import { getHomeLeadEntries } from '@/lib/queries/home'
import { createPublicClient } from '@/lib/supabase/public'

export const revalidate = 0

const PUBLIC_MODERATION_STATUSES = ['clean', 'suggestive']

export default async function HomePage() {
  const { featuredRanking, recentRankings, categories } = await getHomeData()
  const leadRanking = featuredRanking || recentRankings[0] || null
  const leadEntries = await getHomeLeadEntries(leadRanking?.id)
  const archiveRankings = recentRankings.filter((ranking) => ranking.id !== leadRanking?.id).slice(0, 6)

  let totalRankingsCount = 0
  let totalItemsCount = 0

  try {
    const supabase = createPublicClient()
    const [rankingsRes, itemsRes] = await Promise.all([
      supabase
        .from('rankings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .in('moderation_status', PUBLIC_MODERATION_STATUSES)
        .in('image_moderation_status', PUBLIC_MODERATION_STATUSES),
      supabase
        .from('items')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .in('moderation_status', PUBLIC_MODERATION_STATUSES)
        .in('image_moderation_status', PUBLIC_MODERATION_STATUSES),
    ])
    totalRankingsCount = rankingsRes.count || 0
    totalItemsCount = itemsRes.count || 0
  } catch {
    // 공개 통계는 페이지 본문을 막지 않는다.
  }

  return (
    <div className="rw-page pb-20">
      <section className="rw-hero-grid border-b border-[#d9d8d2] bg-[#f7f6f1]">
        <div className="rw-container grid gap-10 py-10 sm:py-14 lg:grid-cols-[0.86fr_1.14fr] lg:gap-14 lg:py-16">
          <div className="flex flex-col justify-between">
            <div>
              <p className="rw-kicker">Ranking Wiki / Evidence first</p>
              <h1 className="rw-display mt-5 max-w-xl text-[2.85rem] font-black leading-[0.98] tracking-[-0.055em] text-[#121417] sm:text-[4.1rem] lg:text-[4.55rem]">
                순위만 보지 말고,
                <br />
                <span className="text-[#3158e8]">근거까지.</span>
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-7 text-[#555d68] sm:text-base">
                후보 범위, 평가 기준, 선정 이유와 변경 이력을 한 화면에서 확인하세요. 랭킹위키는 결과보다
                <strong className="font-extrabold text-[#1f242b]"> 왜 이런 순위가 나왔는지</strong>를 남깁니다.
              </p>

              <div className="mt-8 max-w-xl">
                <SearchForm hero />
              </div>
            </div>

            <div className="mt-9 grid grid-cols-3 border-y border-[#d9d8d2] text-[#20252c] sm:max-w-xl">
              <div className="py-4 pr-4">
                <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[#717883]">Published</span>
                <span className="mt-1 block text-xl font-black tabular-nums">{totalRankingsCount.toLocaleString('ko-KR')}</span>
              </div>
              <div className="border-l border-[#d9d8d2] px-4 py-4">
                <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[#717883]">Items</span>
                <span className="mt-1 block text-xl font-black tabular-nums">{totalItemsCount.toLocaleString('ko-KR')}</span>
              </div>
              <div className="border-l border-[#d9d8d2] pl-4 py-4">
                <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[#717883]">Policy</span>
                <span className="mt-1 block text-sm font-extrabold leading-6">기준·출처 공개</span>
              </div>
            </div>
          </div>

          {leadRanking ? (
            <article className="border border-[#cfd1cc] bg-white shadow-[0_18px_50px_rgba(26,31,38,0.08)]">
              <div className="border-b border-[#dfe0dc] px-5 py-4 sm:px-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#3158e8]">
                    <span>{featuredRanking ? 'Featured ranking' : 'Latest ranking'}</span>
                    <span className="h-1 w-1 rounded-full bg-[#aab0b8]" />
                    <span className="text-[#666e79]">{leadRanking.categories?.name}</span>
                  </div>
                  <time className="text-[11px] font-bold text-[#747c86]">
                    {new Date(leadRanking.published_at || leadRanking.updated_at).toLocaleDateString('ko-KR')}
                  </time>
                </div>
                <h2 className="mt-4 max-w-3xl text-2xl font-black leading-tight tracking-[-0.035em] text-[#15191f] sm:text-[2rem]">
                  {leadRanking.title}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#626a74]">{leadRanking.summary}</p>
              </div>

              <div className="divide-y divide-[#e3e4df]">
                {leadEntries.length > 0 ? (
                  leadEntries.map((entry) => (
                    <Link
                      key={`${leadRanking.id}-${entry.position}`}
                      href={`/items/${entry.item.slug}`}
                      className="group grid grid-cols-[52px_1fr_auto] items-center gap-3 px-5 py-4 transition hover:bg-[#f7f8fb] sm:grid-cols-[66px_1fr_auto] sm:px-7"
                    >
                      <span className="rw-rank-number text-3xl font-black text-[#1b2027] sm:text-[2.15rem]">
                        {String(entry.position).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-extrabold text-[#20252c] sm:text-base">{entry.item.title}</span>
                        <span className="mt-1 block truncate text-[11px] font-semibold text-[#737b85]">
                          {entry.item.brand_or_creator || entry.reason || '순위 근거 확인'}
                        </span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-[#9aa0a9] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#3158e8]" />
                    </Link>
                  ))
                ) : (
                  <div className="px-5 py-8 text-sm leading-7 text-[#626a74] sm:px-7">
                    이 랭킹의 순위표와 선정 근거를 상세 문서에서 확인할 수 있습니다.
                  </div>
                )}
              </div>

              <Link
                href={`/rankings/${leadRanking.slug}`}
                className="group flex items-center justify-between border-t border-[#dfe0dc] bg-[#15191f] px-5 py-4 text-sm font-extrabold text-white transition hover:bg-[#3158e8] sm:px-7"
              >
                전체 순위와 근거 보기
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
            </article>
          ) : (
            <div className="flex min-h-[360px] items-center justify-center border border-dashed border-[#c9cbc6] bg-white/60 p-8 text-center">
              <div>
                <p className="text-sm font-extrabold text-[#20252c]">첫 공개 랭킹을 준비 중입니다.</p>
                <p className="mt-2 text-xs leading-6 text-[#6b727c]">발행된 랭킹이 생기면 대표 순위표가 이곳에 표시됩니다.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rw-container py-12 sm:py-16">
        <div className="flex items-end justify-between gap-4 border-b border-[#cfd1cc] pb-4">
          <div>
            <p className="rw-kicker">Browse by topic</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#15191f] sm:text-3xl">주제별 랭킹 탐색</h2>
          </div>
          <Link href="/categories" className="hidden items-center gap-2 text-xs font-extrabold text-[#444c57] transition hover:text-[#3158e8] sm:inline-flex">
            전체 카테고리 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid border-b border-[#d9d8d2] sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((cat, index) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="group relative min-h-[180px] border-t border-[#d9d8d2] p-5 transition hover:bg-white sm:border-t-0 sm:border-r sm:last:border-r-0 lg:min-h-[205px]"
            >
              <span className="rw-rank-number text-[11px] font-black text-[#8a919a]">{String(index + 1).padStart(2, '0')}</span>
              <div className="mt-12">
                <h3 className="text-lg font-black tracking-[-0.025em] text-[#1c2128] transition group-hover:text-[#3158e8]">{cat.name}</h3>
                <p className="mt-2 line-clamp-2 text-xs leading-6 text-[#68707a]">
                  {cat.description || '이 주제의 공개 랭킹과 세부 분류를 탐색합니다.'}
                </p>
              </div>
              <ArrowUpRight className="absolute right-5 top-5 h-4 w-4 text-[#a0a6ae] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#3158e8]" />
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-[#d9d8d2] bg-white">
        <div className="rw-container py-12 sm:py-16">
          <div className="grid gap-6 lg:grid-cols-[0.34fr_0.66fr] lg:gap-12">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="rw-kicker">Recently updated</p>
              <h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.04em] text-[#15191f]">최근 발행<br className="hidden lg:block" /> 아카이브</h2>
              <p className="mt-4 max-w-xs text-sm leading-7 text-[#656d77]">
                새로 발행되거나 갱신된 랭킹 문서를 최신 순서로 확인합니다. 각 문서에는 기준과 출처가 함께 보존됩니다.
              </p>
              <div className="mt-6 flex items-center gap-4 text-[11px] font-bold text-[#707883]">
                <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{totalRankingsCount} documents</span>
                <span className="inline-flex items-center gap-1.5"><Database className="h-3.5 w-3.5" />{totalItemsCount} items</span>
              </div>
            </div>

            {archiveRankings.length > 0 ? (
              <div className="border-t border-[#cfd1cc]">
                {archiveRankings.map((ranking, index) => (
                  <Link
                    key={ranking.id}
                    href={`/rankings/${ranking.slug}`}
                    className="group grid gap-4 border-b border-[#dfe0dc] py-5 transition hover:bg-[#f8f8f5] sm:grid-cols-[52px_1fr_auto] sm:px-3 sm:py-6"
                  >
                    <span className="rw-rank-number pt-0.5 text-sm font-black text-[#9399a1]">{String(index + 1).padStart(2, '0')}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#3158e8]">
                        <span>{ranking.categories?.name}</span>
                        {ranking.subcategories && <><span className="text-[#a4a9b0]">/</span><span className="text-[#6d747e]">{ranking.subcategories.name}</span></>}
                      </div>
                      <h3 className="mt-2 text-lg font-black leading-snug tracking-[-0.025em] text-[#1d2229] transition group-hover:text-[#3158e8] sm:text-xl">
                        {ranking.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-xs leading-6 text-[#68707a]">{ranking.summary}</p>
                    </div>
                    <div className="flex items-center gap-2 self-start text-[11px] font-bold text-[#747c86] sm:self-center">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(ranking.published_at || ranking.updated_at).toLocaleDateString('ko-KR')}
                      <ArrowUpRight className="ml-1 h-4 w-4 text-[#a0a6ae] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#3158e8]" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="border-y border-[#d9d8d2] py-12 text-sm text-[#68707a]">아직 발행된 랭킹이 없습니다.</div>
            )}
          </div>
        </div>
      </section>

      <section className="rw-container py-12 sm:py-14">
        <div className="grid gap-6 border-t border-[#cfd1cc] pt-7 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-[#1f242b]">
              <ShieldCheck className="h-4 w-4 text-[#3158e8]" />
              랭킹은 결과보다 근거가 먼저입니다.
            </div>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-[#68707a]">
              순위표를 확인한 뒤 후보 범위·평가 기준·출처와 변경 이력을 함께 읽어보세요. 사용자 투표 랭킹은 실시간 결과와 공식 확정 순위를 구분합니다.
            </p>
          </div>
          <Link href="/categories" className="inline-flex items-center gap-2 text-xs font-extrabold text-[#3158e8] hover:text-[#1f44c9]">
            전체 랭킹 탐색 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </div>
  )
}
