import Link from 'next/link'
import { ArrowRight, ArrowUpRight, CalendarDays } from 'lucide-react'
import SearchForm from '@/components/SearchForm'
import FeaturedRankingSlider from '@/components/home/FeaturedRankingSlider'
import { getHomePresentationData } from '@/lib/queries/home'

export const revalidate = 0

function formatDate(value: string | null) {
  if (!value) return '날짜 확인'
  return new Date(value).toLocaleDateString('ko-KR')
}

export default async function HomePage() {
  const { featuredSlides, recentRankings, categories } = await getHomePresentationData()
  const quickCategories = categories.filter((category) => category.ranking_count > 0)
  const visibleCategories = (quickCategories.length > 0 ? quickCategories : categories).slice(0, 8)
  const recentUpdates = recentRankings.slice(0, 6)
  const topicTags = Array.from(new Set(
    featuredSlides.flatMap((ranking) => [
      ranking.subcategories?.name,
      ranking.categories?.name,
    ]).filter((value): value is string => Boolean(value)),
  )).slice(0, 5)

  return (
    <div className="rw-page pb-16">
      <section className="rw-home-hero border-b border-[#d9d8d2] bg-[#f8f9fc]">
        <div className="rw-container grid gap-8 py-9 sm:py-12 lg:grid-cols-[0.76fr_1.24fr] lg:items-stretch lg:gap-10 lg:py-14">
          <div className="flex flex-col justify-center lg:pr-2">
            <p className="text-xs font-black tracking-[-0.02em] text-[#3158e8]">지금 볼 만한 순위</p>
            <h1 className="rw-display mt-4 max-w-xl text-[3rem] font-black leading-[0.98] tracking-[-0.06em] text-[#121722] sm:text-[4.2rem] lg:text-[4.65rem]">
              지금 가장 궁금한 <span className="text-[#3158e8]">순위</span>,
              <br />
              근거까지.
            </h1>

            <div className="mt-7 max-w-xl">
              <SearchForm hero />
            </div>

            {topicTags.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-bold text-[#626b78]">
                <span className="font-black text-[#303743]">추천 검색</span>
                {topicTags.map((topic) => (
                  <Link
                    key={topic}
                    href={`/search?q=${encodeURIComponent(topic)}`}
                    className="transition hover:text-[#3158e8] hover:underline hover:underline-offset-4"
                  >
                    #{topic}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <FeaturedRankingSlider slides={featuredSlides} />
        </div>
      </section>

      <section className="rw-container py-7 sm:py-9">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-black tracking-[-0.035em] text-[#15191f]">주목할 랭킹</h2>
          <Link
            href="/search?type=ranking&sort=latest"
            className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#546071] transition hover:text-[#3158e8]"
          >
            전체 보기 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {featuredSlides.length > 0 ? (
          <div className="rw-scroll-row flex snap-x gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-6 lg:overflow-visible lg:pb-0">
            {featuredSlides.map((ranking, index) => (
              <Link
                key={ranking.id}
                href={`/rankings/${ranking.slug}`}
                className="group min-w-[190px] snap-start overflow-hidden border border-[#d6d9df] bg-white transition hover:-translate-y-0.5 hover:border-[#3158e8] hover:shadow-[0_10px_24px_rgba(29,54,120,0.08)] lg:min-w-0"
              >
                <div className="rw-ranking-strip-visual relative h-[94px] overflow-hidden border-b border-[#e2e4e8] px-4 py-3">
                  <span className="text-[9px] font-black uppercase tracking-[0.13em] text-[#3158e8]">
                    {ranking.subcategories?.name || ranking.categories?.name || 'Ranking'}
                  </span>
                  <span className="rw-rank-number absolute -bottom-2 right-3 text-[4.2rem] font-black leading-none text-[#dfe6ff] transition group-hover:text-[#cbd8ff]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="absolute bottom-3 left-4 max-w-[120px] truncate text-[10px] font-black text-[#293246]">
                    {ranking.entries[0]?.item.title || 'TOP 순위'}
                  </span>
                </div>
                <div className="min-h-[88px] px-4 py-3.5">
                  <h3 className="line-clamp-2 text-sm font-black leading-[1.35] tracking-[-0.025em] text-[#202630] transition group-hover:text-[#3158e8]">
                    {ranking.title}
                  </h3>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[9px] font-bold text-[#697281]">
                    <span className="truncate">{ranking.categories?.name || '랭킹'}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border-y border-[#d9d8d2] py-8 text-sm font-bold text-[#626b78]">공개 랭킹을 준비 중입니다.</div>
        )}
      </section>

      <section className="border-y border-[#d9d8d2] bg-[#f7f7f4]">
        <div className="rw-container py-7 sm:py-9">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-black tracking-[-0.035em] text-[#15191f]">카테고리 둘러보기</h2>
            <Link
              href="/categories"
              className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#546071] transition hover:text-[#3158e8]"
            >
              전체 카테고리 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden border border-[#d9d8d2] bg-[#d9d8d2] sm:grid-cols-4 lg:grid-cols-8">
            {visibleCategories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="group min-h-[88px] bg-white px-4 py-4 transition hover:bg-[#eef2ff]"
              >
                <span className="block text-sm font-black tracking-[-0.025em] text-[#252c37] transition group-hover:text-[#3158e8]">
                  {category.name}
                </span>
                <span className="mt-3 block text-[10px] font-black tabular-nums text-[#727b88]">
                  랭킹 {category.ranking_count}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="rw-container py-8 sm:py-10">
        <div className="mb-3 flex items-center justify-between gap-4 border-b border-[#cfd2d7] pb-4">
          <h2 className="text-xl font-black tracking-[-0.035em] text-[#15191f]">최근 업데이트</h2>
          <Link
            href="/search?type=ranking&sort=latest"
            className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#546071] transition hover:text-[#3158e8]"
          >
            전체 보기 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentUpdates.length > 0 ? (
          <div className="divide-y divide-[#dde0e4] border-b border-[#cfd2d7]">
            {recentUpdates.map((ranking) => (
              <Link
                key={ranking.id}
                href={`/rankings/${ranking.slug}`}
                className="group grid gap-2 py-4 transition hover:bg-white sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center sm:px-3"
              >
                <div className="flex min-w-0 items-center gap-2 text-[10px] font-black text-[#3158e8]">
                  <span className="truncate">{ranking.categories?.name || '랭킹'}</span>
                  {ranking.subcategories?.name ? (
                    <>
                      <span className="text-[#afb4bc]">·</span>
                      <span className="truncate text-[#6b7481]">{ranking.subcategories.name}</span>
                    </>
                  ) : null}
                </div>
                <h3 className="min-w-0 truncate text-sm font-black tracking-[-0.02em] text-[#222934] transition group-hover:text-[#3158e8] sm:text-[15px]">
                  {ranking.title}
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] font-bold tabular-nums text-[#727b88]">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(ranking.published_at || ranking.updated_at)}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border-y border-[#d9d8d2] py-10 text-sm font-bold text-[#626b78]">아직 발행된 랭킹이 없습니다.</div>
        )}
      </section>
    </div>
  )
}
