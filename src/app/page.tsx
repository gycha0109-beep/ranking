import Link from 'next/link'
import { ArrowRight, CalendarDays } from 'lucide-react'
import SafeImage from '@/components/SafeImage'
import SearchForm from '@/components/SearchForm'
import { getHomePresentationData, type HomeFeaturedSlide } from '@/lib/queries/home'

export const revalidate = 0

function formatDate(value: string | null) {
  if (!value) return '날짜 확인'
  return new Date(value).toLocaleDateString('ko-KR')
}

function RankingVisual({ ranking, className = '' }: { ranking: HomeFeaturedSlide; className?: string }) {
  if (!ranking.visual_image_url) {
    return (
      <div
        className={`absolute inset-0 bg-[linear-gradient(135deg,#172033_0%,#244aa8_54%,#4f78ee_100%)] ${className}`}
        aria-hidden="true"
      />
    )
  }

  return (
    <SafeImage
      src={ranking.visual_image_url}
      alt=""
      fallbackSrc="/globe.svg"
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
    />
  )
}

function LeadRankingCard({ ranking }: { ranking: HomeFeaturedSlide }) {
  const first = ranking.entries.find((entry) => entry.position === 1)
  const second = ranking.entries.find((entry) => entry.position === 2)
  const third = ranking.entries.find((entry) => entry.position === 3)

  return (
    <Link
      href={`/rankings/${ranking.slug}`}
      className="group relative min-h-[420px] overflow-hidden rounded-[18px] bg-[#15191f] text-white shadow-[0_16px_36px_rgba(17,24,39,0.14)] sm:min-h-[480px] lg:min-h-[520px]"
    >
      <RankingVisual ranking={ranking} className="transition duration-500 group-hover:scale-[1.025]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,11,18,0.92)_0%,rgba(8,11,18,0.72)_45%,rgba(8,11,18,0.18)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/70 to-transparent" />

      <div className="relative z-10 flex min-h-[420px] flex-col p-5 sm:min-h-[480px] sm:p-7 lg:min-h-[520px] lg:p-8">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-white/92 px-3 py-1.5 text-[10px] font-black text-[#1d4ed8] shadow-sm">
            {ranking.categories?.name || '랭킹'}
          </span>
          <span className="text-[11px] font-bold text-white/75">자세히 보기 →</span>
        </div>

        <div className="mt-5 max-w-[620px]">
          <h2 className="text-[1.5rem] font-black leading-[1.18] tracking-[-0.045em] sm:text-[2rem] lg:text-[2.25rem]">
            {ranking.title}
          </h2>
        </div>

        <div className="mt-auto pt-14">
          <div className="flex items-end gap-4">
            <span className="rw-rank-number text-[5.2rem] font-black leading-[0.75] tracking-[-0.08em] sm:text-[7rem]">01</span>
            <div className="min-w-0 pb-1">
              <p className="truncate text-[1.75rem] font-black leading-none tracking-[-0.04em] sm:text-[2.25rem]">
                {first?.item.title || '1위 확인하기'}
              </p>
              {first?.item.brand_or_creator ? (
                <p className="mt-2 truncate text-xs font-bold text-white/72 sm:text-sm">{first.item.brand_or_creator}</p>
              ) : null}
            </div>
          </div>

          {(second || third) && (
            <div className="mt-6 grid border-t border-white/25 bg-black/15 backdrop-blur-[2px] sm:grid-cols-2">
              {[second, third].filter(Boolean).map((entry) => (
                <div key={entry!.position} className="flex min-w-0 items-center gap-3 border-b border-white/15 px-1 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0">
                  <span className="rw-rank-number text-2xl font-black text-white/90">{String(entry!.position).padStart(2, '0')}</span>
                  <span className="truncate text-sm font-black text-white">{entry!.item.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function SideRankingCard({ ranking }: { ranking: HomeFeaturedSlide }) {
  const entries = ranking.entries.slice(0, 3)
  const first = entries[0]

  return (
    <Link
      href={`/rankings/${ranking.slug}`}
      className="group relative min-h-[246px] overflow-hidden rounded-[18px] bg-[#15191f] text-white shadow-[0_10px_28px_rgba(17,24,39,0.1)]"
    >
      <RankingVisual ranking={ranking} className="transition duration-500 group-hover:scale-[1.03]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,11,18,0.9),rgba(8,11,18,0.4))]" />
      <div className="relative z-10 flex min-h-[246px] flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="rounded-full bg-white/92 px-2.5 py-1 text-[9px] font-black text-[#1d4ed8]">{ranking.categories?.name || '랭킹'}</span>
            <h2 className="mt-3 line-clamp-2 max-w-md text-base font-black leading-6 tracking-[-0.03em] sm:text-lg">{ranking.title}</h2>
          </div>
          <span className="text-lg text-white/75 transition group-hover:translate-x-0.5">↗</span>
        </div>

        <div className="mt-auto">
          <div className="flex items-end gap-3">
            <span className="rw-rank-number text-[3.25rem] font-black leading-none">01</span>
            <span className="min-w-0 truncate pb-1 text-xl font-black tracking-[-0.035em]">{first?.item.title || 'TOP 1'}</span>
          </div>
          {entries.length > 1 ? (
            <div className="mt-4 flex gap-5 border-t border-white/25 pt-3 text-xs font-bold text-white/86">
              {entries.slice(1).map((entry) => (
                <span key={entry.position} className="min-w-0 truncate">
                  <b className="mr-2 text-white/55">{String(entry.position).padStart(2, '0')}</b>{entry.item.title}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

function SmallRankingCard({ ranking }: { ranking: HomeFeaturedSlide }) {
  const entries = ranking.entries.slice(0, 3)

  return (
    <Link href={`/rankings/${ranking.slug}`} className="group overflow-hidden rounded-[14px] border border-[#e2e5ea] bg-white transition hover:-translate-y-0.5 hover:border-[#cbd2dc] hover:shadow-[0_12px_28px_rgba(22,34,56,0.08)]">
      <div className="relative h-[142px] overflow-hidden bg-[#eef2f8]">
        <RankingVisual ranking={ranking} className="transition duration-500 group-hover:scale-[1.035]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/15" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-black text-[#1d4ed8]">{ranking.categories?.name || '랭킹'}</span>
          <h3 className="mt-2 line-clamp-2 text-sm font-black leading-5 tracking-[-0.025em]">{ranking.title}</h3>
        </div>
      </div>
      <div className="px-4 py-3.5">
        {entries.length > 0 ? (
          <div className="flex items-center gap-3 text-xs font-bold text-[#4b5563]">
            {entries.map((entry) => (
              <span key={entry.position} className="min-w-0 truncate">
                <b className="mr-1.5 text-[#111827]">{String(entry.position).padStart(2, '0')}</b>{entry.item.title}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs font-bold text-[#6b7280]">순위를 확인해보세요.</p>
        )}
      </div>
    </Link>
  )
}

export default async function HomePage() {
  const { featuredSlides, recentRankings, categories } = await getHomePresentationData()
  const quickCategories = categories.filter((category) => category.ranking_count > 0)
  const visibleCategories = (quickCategories.length > 0 ? quickCategories : categories).slice(0, 7)
  const heroRankings = featuredSlides.slice(0, 3)
  const moreRankings = featuredSlides.slice(3, 7)
  const recentUpdates = recentRankings.slice(0, 5)

  return (
    <div className="rw-page bg-white pb-16 sm:pb-20">
      <section className="rw-container pt-7 sm:pt-10 lg:pt-12">
        <div className="max-w-3xl">
          <h1 className="rw-display text-[2.65rem] font-black leading-[0.98] tracking-[-0.065em] text-[#101318] sm:text-[3.7rem] lg:text-[4.35rem]">
            오늘 뭐가 1위일까?
          </h1>
          <p className="mt-3 text-sm font-medium leading-6 text-[#68717e] sm:text-[15px]">
            다양한 주제의 랭킹을 한눈에 둘러보고, 궁금한 순위를 바로 확인해보세요.
          </p>
        </div>

        <div className="mt-5 max-w-2xl">
          <SearchForm hero />
        </div>

        <div className="rw-scroll-row mt-4 flex gap-2 overflow-x-auto pb-2">
          {visibleCategories.map((category, index) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${index === 0 ? 'border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]' : 'border-[#e0e3e8] bg-white text-[#454e5b] hover:border-[#b9c1cd] hover:bg-[#f8fafc]'}`}
            >
              {category.name}
            </Link>
          ))}
          <Link href="/categories" className="shrink-0 rounded-full border border-[#e0e3e8] bg-white px-4 py-2 text-xs font-black text-[#454e5b] transition hover:border-[#b9c1cd] hover:bg-[#f8fafc]">
            전체 보기
          </Link>
        </div>
      </section>

      <section className="rw-container mt-5 sm:mt-6">
        {heroRankings.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-[1.58fr_1fr]">
            <LeadRankingCard ranking={heroRankings[0]} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {heroRankings.slice(1, 3).map((ranking) => <SideRankingCard key={ranking.id} ranking={ranking} />)}
            </div>
          </div>
        ) : (
          <div className="rounded-[18px] border border-[#e2e5ea] bg-[#f7f8fb] px-6 py-16 text-center text-sm font-bold text-[#6b7280]">공개 랭킹을 준비 중입니다.</div>
        )}
      </section>

      {moreRankings.length > 0 ? (
        <section className="rw-container mt-9 sm:mt-11">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-black tracking-[-0.035em] text-[#171a1f]">지금 많이 보는 랭킹</h2>
            <Link href="/search?type=ranking" className="inline-flex items-center gap-1 text-xs font-black text-[#576171] transition hover:text-[#2563eb]">
              전체 보기 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {moreRankings.map((ranking) => <SmallRankingCard key={ranking.id} ranking={ranking} />)}
          </div>
        </section>
      ) : null}

      <section className="rw-container mt-10 grid gap-5 lg:mt-12 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[14px] border border-[#e1e4e9] bg-white p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-lg font-black tracking-[-0.03em] text-[#171a1f]">최근 업데이트</h2>
            <Link href="/search?type=ranking&sort=latest" className="inline-flex items-center gap-1 text-[11px] font-black text-[#647083] hover:text-[#2563eb]">
              더보기 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentUpdates.length > 0 ? (
            <div className="divide-y divide-[#edf0f3]">
              {recentUpdates.map((ranking) => (
                <Link key={ranking.id} href={`/rankings/${ranking.slug}`} className="group flex items-center justify-between gap-4 py-3.5 first:pt-1 last:pb-1">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black tracking-[-0.02em] text-[#252a32] transition group-hover:text-[#2563eb]">{ranking.title}</p>
                    <p className="mt-1 truncate text-[10px] font-bold text-[#89919c]">{ranking.categories?.name || '랭킹'}{ranking.subcategories?.name ? ` · ${ranking.subcategories.name}` : ''}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold tabular-nums text-[#8a929d]">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(ranking.published_at || ranking.updated_at)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-8 text-sm font-bold text-[#6b7280]">아직 발행된 랭킹이 없습니다.</p>
          )}
        </div>

        <div className="rounded-[14px] border border-[#e1e4e9] bg-[#f7f9fc] p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#2563eb]">Explore more</p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-[#171a1f]">원하는 주제로 바로 들어가세요</h2>
          <p className="mt-2 text-xs leading-6 text-[#6b7280]">카테고리에서 관심 있는 분야의 최신 랭킹과 항목을 한 번에 둘러볼 수 있습니다.</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {visibleCategories.slice(0, 6).map((category) => (
              <Link key={category.id} href={`/categories/${category.slug}`} className="rounded-[10px] border border-[#e0e4e9] bg-white px-3.5 py-3 text-xs font-black text-[#303743] transition hover:border-[#9fb2e8] hover:text-[#2563eb]">
                <span className="block truncate">{category.name}</span>
                <span className="mt-1 block text-[9px] font-bold tabular-nums text-[#9299a3]">랭킹 {category.ranking_count}</span>
              </Link>
            ))}
          </div>
          <Link href="/categories" className="mt-5 inline-flex items-center gap-1.5 text-xs font-black text-[#2563eb]">
            모든 카테고리 보기 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </div>
  )
}
