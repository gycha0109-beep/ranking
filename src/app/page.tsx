import React from 'react'
import Link from 'next/link'
import { getHomeData } from '@/lib/queries/public'
import { createPublicClient } from '@/lib/supabase/public'
import SearchForm from '@/components/SearchForm'
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Database,
  FileText,
  FolderOpen,
  Inbox,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react'

export const revalidate = 0

const PUBLIC_MODERATION_STATUSES = ['clean', 'suggestive']

export default async function HomePage() {
  const { featuredRanking, recentRankings, categories } = await getHomeData()

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
      <section className="border-b border-[#e4e8ed] bg-white">
        <div className="rw-container grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:py-20">
          <div className="max-w-3xl">
            <p className="rw-kicker flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Ranking Wiki
            </p>
            <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] text-[#171a1f] sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
              무엇이 더 좋은지,
              <br />왜 그런지까지 찾아보세요.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#5f6875] sm:text-base">
              랭킹위키는 후보 범위, 평가 기준, 선정 이유와 변경 이력을 함께 공개하는 랭킹 아카이브입니다.
              결과만 나열하지 않고 순위가 만들어진 근거를 남깁니다.
            </p>
            <div className="mt-7 max-w-2xl">
              <SearchForm />
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#77808d]">
              <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />공개 랭킹 {totalRankingsCount.toLocaleString('ko-KR')}개</span>
              <span className="inline-flex items-center gap-1.5"><Database className="h-3.5 w-3.5" />아이템 {totalItemsCount.toLocaleString('ko-KR')}개</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />기준·출처 공개</span>
            </div>
          </div>

          <div className="rounded-[22px] border border-[#dfe4ea] bg-[#f7f8fa] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#3457c8]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-[#20242a]">랭킹을 읽는 방법</p>
                <p className="mt-1 text-xs leading-6 text-[#6b7280]">
                  순위표를 먼저 확인한 뒤 기준·후보 범위·출처와 변경 이력을 확인해 보세요. 사용자 투표 랭킹은 실시간 결과와 공식 확정 순위를 구분합니다.
                </p>
              </div>
            </div>
            <Link href="/categories" className="mt-5 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#3457c8] hover:text-[#2445ad]">
              전체 카테고리 둘러보기 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <div className="rw-container space-y-14 pt-12 sm:pt-14">
        {featuredRanking && (
          <section>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="rw-kicker">Featured</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#171a1f]">지금 읽어볼 랭킹</h2>
              </div>
            </div>

            <Link
              href={`/rankings/${featuredRanking.slug}`}
              className="rw-surface rw-card rw-card-interactive group grid overflow-hidden p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#6b7280]">
                  <span className="text-[#3457c8]">{featuredRanking.categories?.name}</span>
                  {featuredRanking.subcategories && <><span>·</span><span>{featuredRanking.subcategories.name}</span></>}
                  <span>·</span>
                  <span>{new Date(featuredRanking.published_at || featuredRanking.updated_at).toLocaleDateString('ko-KR')}</span>
                </div>
                <h3 className="mt-4 max-w-3xl text-2xl font-black tracking-[-0.035em] text-[#171a1f] transition group-hover:text-[#2445ad] sm:text-3xl">
                  {featuredRanking.title}
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5f6875]">{featuredRanking.summary}</p>
              </div>
              <span className="mt-6 inline-flex h-11 items-center gap-2 self-end rounded-xl bg-[#171a1f] px-4 text-xs font-extrabold text-white transition group-hover:bg-[#2445ad] lg:mt-0">
                랭킹 보기 <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          </section>
        )}

        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="rw-kicker">Topics</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#171a1f]">카테고리</h2>
            </div>
            <Link href="/categories" className="hidden items-center gap-1 text-xs font-bold text-[#5f6875] hover:text-[#2445ad] sm:inline-flex">
              전체 보기 <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <Link key={cat.id} href={`/categories/${cat.slug}`} className="rw-surface rw-card rw-card-interactive group p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f0f2f5] text-[#667085] transition group-hover:bg-[#eef2ff] group-hover:text-[#3457c8]">
                    <FolderOpen className="h-4 w-4" />
                  </span>
                  <ChevronRight className="h-4 w-4 text-[#a4acb7] transition group-hover:translate-x-0.5 group-hover:text-[#3457c8]" />
                </div>
                <h3 className="mt-5 text-base font-extrabold text-[#20242a] group-hover:text-[#2445ad]">{cat.name}</h3>
                <p className="mt-2 line-clamp-2 text-xs leading-6 text-[#6b7280]">
                  {cat.description || '이 카테고리의 공개 랭킹과 세부 주제를 확인합니다.'}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-5">
            <p className="rw-kicker">Recently updated</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#171a1f]">최근 발행 랭킹</h2>
          </div>

          {recentRankings.length > 0 ? (
            <div className="overflow-hidden rounded-[20px] border border-[#dde2e8] bg-white">
              {recentRankings.map((ranking, index) => (
                <Link
                  key={ranking.id}
                  href={`/rankings/${ranking.slug}`}
                  className={`group grid gap-3 px-5 py-5 transition hover:bg-[#f8f9fb] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6 ${index > 0 ? 'border-t border-[#edf0f3]' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#7b8491]">
                      <span className="text-[#3457c8]">{ranking.categories?.name}</span>
                      {ranking.subcategories && <><span>·</span><span>{ranking.subcategories.name}</span></>}
                    </div>
                    <h3 className="mt-1.5 truncate text-base font-extrabold text-[#20242a] transition group-hover:text-[#2445ad]">{ranking.title}</h3>
                    <p className="mt-1 line-clamp-1 text-xs leading-5 text-[#737c89]">{ranking.summary}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-semibold text-[#8a94a3]">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(ranking.published_at || ranking.updated_at).toLocaleDateString('ko-KR')}
                    <ChevronRight className="h-4 w-4 text-[#a4acb7] transition group-hover:translate-x-0.5 group-hover:text-[#3457c8]" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rw-surface rw-card flex flex-col items-center justify-center px-6 py-14 text-center">
              <Inbox className="h-7 w-7 text-[#a4acb7]" />
              <h3 className="mt-4 text-sm font-extrabold text-[#3f4752]">아직 발행된 랭킹이 없습니다</h3>
              <p className="mt-2 text-xs text-[#8a94a3]">첫 공개 랭킹이 발행되면 이곳에 표시됩니다.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
