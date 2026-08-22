import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublishedRankingBySlug, getRelatedRankings } from '@/lib/queries/public'
import { getRankingSponsorshipDisclosures } from '@/lib/queries/sponsorships'
import { formatKoreanDate, formatRankingBasis } from '@/lib/ranking-display'
import {
  Award,
  CalendarDays,
  ChevronRight,
  Compass,
  ExternalLink,
  HelpCircle,
  Info,
  MessageCircle,
  PlayCircle,
  Scale,
  Star,
  Tag,
} from 'lucide-react'
import SafeImage from '@/components/SafeImage'
import CommentSection from '@/components/comments/CommentSection'
import SponsorshipDisclosure from '@/components/sponsorship/SponsorshipDisclosure'

export const revalidate = 0

interface Props {
  params: Promise<{ rankingSlug: string }>
}

function getRankingTypeName(type: string) {
  const map: Record<string, string> = {
    editor_pick: '에디터 선정',
    popularity: '인기 지표',
    quality: '품질 평가',
    purpose: '목적별 추천',
    metric: '공식 지표',
    user_vote: '사용자 투표',
    sponsored: '스폰서십',
  }
  return map[type] || type
}

function getDisplayScores(entry: any) {
  const scores = Array.isArray(entry.score_json?.scores) ? entry.score_json.scores : []
  return scores.filter((score: any) => {
    const value = String(score?.score ?? '').trim()
    return value && value !== `${entry.position}위` && value !== String(entry.position)
  })
}

function getHeroMetric(entry: any, rankingType: string) {
  const score = getDisplayScores(entry)[0]
  if (score) return { label: String(score.criterion || ''), value: String(score.score) }
  if (rankingType !== 'metric' && entry.editor_score != null) {
    return { label: '에디터 점수', value: Number(entry.editor_score).toFixed(1) }
  }
  return null
}

function isVideoSource(url?: string | null) {
  if (!url) return false
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return hostname === 'youtu.be'
      || hostname.endsWith('youtube.com')
      || hostname.endsWith('vimeo.com')
  } catch {
    return false
  }
}

function HeroVisual({ src, alt }: { src?: string | null; alt: string }) {
  if (!src) {
    return (
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_76%_26%,rgba(71,112,255,0.74),transparent_34%),linear-gradient(135deg,#121722_0%,#1c2e5a_52%,#174bd8_100%)]"
        aria-hidden="true"
      />
    )
  }

  return (
    <SafeImage
      src={src}
      alt={alt}
      fallbackSrc="/globe.svg"
      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.015]"
    />
  )
}

export default async function RankingDetailPage({ params }: Props) {
  const { rankingSlug } = await params
  const ranking = await getPublishedRankingBySlug(rankingSlug)
  if (!ranking) notFound()

  const [relatedRankings, sponsorshipDisclosures] = await Promise.all([
    getRelatedRankings(ranking),
    getRankingSponsorshipDisclosures(ranking.id),
  ])

  const rankingDisclosures = sponsorshipDisclosures.filter((disclosure) => disclosure.target_type === 'ranking')
  const placementDisclosures = sponsorshipDisclosures.filter((disclosure) => disclosure.target_type === 'placement')
  const scopeItems = Object.entries(ranking.scope_json || {}).map(([key, val]) => ({ label: key.toUpperCase(), value: String(val) }))
  const topEntries = ranking.entries.slice(0, 5).filter((entry: any) => entry.items)
  const firstEntry = topEntries[0]
  const secondaryEntries = topEntries.slice(1, 3)
  const followingEntries = topEntries.slice(3, 5)
  const primarySource = ranking.sources.find((source: any) => source.url) || ranking.sources[0]
  const relatedVideo = ranking.sources.find((source: any) => isVideoSource(source.url))
  const publishedOrUpdated = ranking.published_at || ranking.updated_at
  const basisDate = formatRankingBasis(ranking.scope_json, publishedOrUpdated)
  const heroImageUrl = ranking.cover_image_url || firstEntry?.items?.image_url || null
  const firstMetric = firstEntry ? getHeroMetric(firstEntry, ranking.ranking_type) : null

  return (
    <div className="rw-page bg-white pb-16 sm:pb-20">
      <header className="border-b border-[#e4e7eb] bg-white">
        <div className="rw-container max-w-[1160px] py-6 sm:py-8 lg:py-10">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-[#8a929d] sm:text-xs">
            <Link href="/" className="hover:text-[#2563eb]">홈</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/categories/${ranking.categories?.slug}`} className="hover:text-[#2563eb]">{ranking.categories?.name}</Link>
            {ranking.subcategories && (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <Link href={`/categories/${ranking.categories?.slug}/${ranking.subcategories.slug}`} className="hover:text-[#2563eb]">{ranking.subcategories.name}</Link>
              </>
            )}
          </div>

          <div className="mt-5 max-w-[920px] sm:mt-6">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black">
              <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-[#1d4ed8]">{getRankingTypeName(ranking.ranking_type)}</span>
              <span className="inline-flex items-center gap-1.5 text-[#69717c]"><CalendarDays className="h-3.5 w-3.5" />{basisDate}</span>
              {primarySource?.label && <span className="text-[#8a929d]">출처 {primarySource.label}</span>}
            </div>

            <h1 className="rw-display mt-3 text-[2.2rem] font-black leading-[1.05] tracking-[-0.06em] text-[#111318] sm:text-[3.15rem] lg:text-[3.65rem]">
              {ranking.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-[#626b77] sm:text-[15px]">{ranking.summary}</p>
          </div>

          {rankingDisclosures.length > 0 && <div className="mt-5"><SponsorshipDisclosure disclosures={rankingDisclosures} /></div>}

          {firstEntry && (
            <div className="mt-6 grid gap-3 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="group relative min-h-[390px] overflow-hidden rounded-[18px] bg-[#15191f] text-white shadow-[0_18px_42px_rgba(17,24,39,0.14)] sm:min-h-[460px]">
                <HeroVisual src={heroImageUrl} alt={ranking.cover_image_url ? ranking.title : firstEntry.items.title} />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,11,17,0.9)_0%,rgba(8,11,17,0.68)_43%,rgba(8,11,17,0.18)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 via-black/45 to-transparent" />

                <div className="relative z-10 flex min-h-[390px] flex-col p-5 sm:min-h-[460px] sm:p-7 lg:p-8">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white/92 px-3 py-1.5 text-[10px] font-black text-[#1d4ed8]">{ranking.categories?.name || '랭킹'}</span>
                    <span className="text-[10px] font-bold text-white/68">최근 업데이트 {formatKoreanDate(ranking.updated_at)}</span>
                  </div>

                  <Link href={`/items/${firstEntry.items.slug}`} className="mt-auto block max-w-[720px] pt-14">
                    <div className="flex items-end gap-4 sm:gap-5">
                      <span className="rw-rank-number text-[5.5rem] font-black leading-[0.72] tracking-[-0.09em] text-white sm:text-[8.5rem]">01</span>
                      <div className="min-w-0 pb-1 sm:pb-2">
                        <h2 className="line-clamp-2 text-[1.75rem] font-black leading-[1.02] tracking-[-0.045em] sm:text-[2.65rem]">{firstEntry.items.title}</h2>
                        {firstEntry.items.brand_or_creator && <p className="mt-2 truncate text-xs font-bold text-white/72 sm:text-sm">{firstEntry.items.brand_or_creator}</p>}
                        {firstMetric && <p className="mt-2 text-sm font-black text-[#dbe7ff] sm:text-base">{firstMetric.value}</p>}
                      </div>
                    </div>
                  </Link>

                  {secondaryEntries.length > 0 && (
                    <div className="mt-6 grid border-t border-white/25 bg-black/10 sm:grid-cols-2">
                      {secondaryEntries.map((entry: any) => {
                        const metric = getHeroMetric(entry, ranking.ranking_type)
                        return (
                          <Link key={entry.id} href={`/items/${entry.items.slug}`} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-b border-white/15 px-1 py-4 last:border-b-0 hover:bg-white/5 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0">
                            <span className="rw-rank-number text-2xl font-black text-white/88">{String(entry.position).padStart(2, '0')}</span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-white">{entry.items.title}</p>
                              {metric && <p className="mt-1 truncate text-[10px] font-bold text-white/62">{metric.value}</p>}
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <aside className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-[auto_1fr]">
                <div className="overflow-hidden rounded-[14px] border border-[#dfe3e8] bg-white">
                  {followingEntries.length > 0 ? followingEntries.map((entry: any) => {
                    const metric = getHeroMetric(entry, ranking.ranking_type)
                    return (
                      <Link key={entry.id} href={`/items/${entry.items.slug}`} className="grid grid-cols-[46px_minmax(0,1fr)] gap-3 border-b border-[#edf0f3] px-4 py-4 last:border-b-0 hover:bg-[#f8fafc]">
                        <span className="rw-rank-number text-2xl font-black text-[#303640]">{String(entry.position).padStart(2, '0')}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#232831]">{entry.items.title}</p>
                          {metric && <p className="mt-1 text-[10px] font-bold text-[#6f7782]">{metric.value}</p>}
                        </div>
                      </Link>
                    )
                  }) : (
                    <div className="px-4 py-6 text-xs font-bold text-[#737c89]">상위 항목을 확인해보세요.</div>
                  )}
                </div>

                <div className="rounded-[14px] border border-[#dfe3e8] bg-[#f7f9fc] p-5">
                  <div className="flex items-center gap-2 text-[#2563eb]"><Info className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.08em]">Ranking basis</span></div>
                  <h3 className="mt-3 text-base font-black tracking-[-0.03em] text-[#20242a]">이 랭킹은 무엇을 기준으로 하나요?</h3>
                  <dl className="mt-4 divide-y divide-[#e7eaf0]">
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 py-2.5 first:pt-0">
                      <dt className="text-[10px] font-bold text-[#8a929d]">기준 시점</dt>
                      <dd className="text-[11px] font-black text-[#404854]">{basisDate}</dd>
                    </div>
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 py-2.5">
                      <dt className="text-[10px] font-bold text-[#8a929d]">출처</dt>
                      <dd className="line-clamp-2 text-[11px] font-black text-[#404854]">{primarySource?.label || '공개 출처'}</dd>
                    </div>
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 py-2.5 last:pb-0">
                      <dt className="text-[10px] font-bold text-[#8a929d]">항목 수</dt>
                      <dd className="text-[11px] font-black text-[#404854]">{ranking.entries.length}개</dd>
                    </div>
                  </dl>
                  <a href="#methodology" className="mt-4 inline-flex items-center gap-1 text-[11px] font-black text-[#2563eb]">기준 자세히 보기 <ChevronRight className="h-3.5 w-3.5" /></a>
                </div>
              </aside>
            </div>
          )}
        </div>
      </header>

      <div className="rw-container max-w-[1160px] space-y-10 pt-8 sm:space-y-12 sm:pt-10">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="rw-kicker">Full ranking</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#171a1f]">순위</h2>
            </div>
            <span className="text-xs font-semibold text-[#8a94a3]">총 {ranking.entries.length}개 항목</span>
          </div>

          <ol className="overflow-hidden rounded-[14px] border border-[#dfe3e8] bg-white">
            {ranking.entries.map((entry: any) => {
              const item = entry.items
              if (!item) return null
              const displayScores = getDisplayScores(entry)
              const disclosures = placementDisclosures.filter((disclosure) => disclosure.item_id === item.id)

              return (
                <li key={entry.id} className="border-b border-[#e8ebef] last:border-b-0">
                  <div className="grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-[64px_56px_minmax(0,1fr)_minmax(160px,auto)] md:items-center md:gap-4">
                    <span className={`rw-rank-number text-[2rem] font-black leading-none sm:text-[2.35rem] ${entry.position === 1 ? 'text-[#2563eb]' : 'text-[#59616c]'}`}>{String(entry.position).padStart(2, '0')}</span>

                    <div className="hidden h-12 w-12 items-center justify-center overflow-hidden rounded-[10px] border border-[#e0e4e9] bg-[#f3f5f7] md:flex">
                      {item.image_url ? (
                        <SafeImage src={item.image_url} alt={item.title} fallbackSrc="/globe.svg" className="h-full w-full object-cover" />
                      ) : (
                        <Award className="h-5 w-5 text-[#9aa3af]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link href={`/items/${item.slug}`} className="group inline-flex min-w-0 items-center gap-1">
                          <h3 className="line-clamp-1 text-sm font-black tracking-[-0.02em] text-[#20242a] transition group-hover:text-[#2563eb] sm:text-[15px]">{item.title}</h3>
                          <ChevronRight className="h-4 w-4 shrink-0 text-[#a8b0ba] group-hover:text-[#2563eb]" />
                        </Link>
                        {item.brand_or_creator && <span className="text-[10px] font-semibold text-[#8a94a3]">{item.brand_or_creator}</span>}
                        {ranking.ranking_type !== 'metric' && entry.editor_score != null && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#fff7e6] px-2 py-1 text-[10px] font-extrabold text-[#8f650f]"><Star className="h-3 w-3 fill-current" />{Number(entry.editor_score).toFixed(1)}</span>
                        )}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#69717c]">{entry.reason}</p>
                      {disclosures.length > 0 && <div className="mt-2"><SponsorshipDisclosure disclosures={disclosures} compact /></div>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      {displayScores.slice(0, 2).map((scoreObj: any, index: number) => (
                        <span key={`${entry.id}-${index}`} className="inline-flex items-center gap-1.5 rounded-md bg-[#f5f7fa] px-2.5 py-1.5 text-[10px]">
                          <span className="text-[#6b7280]">{scoreObj.criterion}</span>
                          <strong className="font-black text-[#303640]">{String(scoreObj.score)}</strong>
                        </span>
                      ))}
                      {item.external_url && <a href={item.external_url} target="_blank" rel="noopener noreferrer" aria-label={`${item.title} 공식 사이트 열기`} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#d7dce2] text-[#6b7280] hover:border-[#2563eb] hover:text-[#2563eb]"><ExternalLink className="h-3.5 w-3.5" /></a>}
                      {item.affiliate_url && <a href={item.affiliate_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-[#cbd5f5] bg-[#eef2ff] px-2.5 py-1.5 text-[10px] font-extrabold text-[#3457c8]">구매 정보 <ExternalLink className="h-3 w-3" /></a>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <section className={`grid gap-4 ${relatedVideo ? 'lg:grid-cols-[1.2fr_0.8fr]' : 'lg:grid-cols-2'}`}>
          <article className="rounded-[14px] border border-[#e0e4e9] bg-[#f8fafc] px-5 py-5 sm:px-6">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-[#2563eb]" />
              <h2 className="text-sm font-black text-[#20242a]">이 랭킹에 대해</h2>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#4f5864]">{ranking.body || ranking.summary}</p>
          </article>

          {relatedVideo ? (
            <a href={relatedVideo.url} target="_blank" rel="noopener noreferrer" className="group flex min-h-[170px] flex-col justify-between overflow-hidden rounded-[14px] border border-[#26334b] bg-[#15191f] p-5 text-white transition hover:border-[#2563eb] sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#aebbf2]">관련 영상</span>
                <PlayCircle className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="line-clamp-2 text-lg font-black leading-7">{relatedVideo.label}</h3>
                {relatedVideo.note && <p className="mt-2 line-clamp-2 text-xs leading-6 text-[#c6ccd7]">{relatedVideo.note}</p>}
              </div>
            </a>
          ) : (
            <article className="rounded-[14px] border border-[#e0e4e9] bg-white p-5 sm:p-6">
              <h2 className="text-sm font-black text-[#20242a]">상위권 한눈에 보기</h2>
              <div className="mt-4 divide-y divide-[#edf0f3]">
                {topEntries.slice(0, 3).map((entry: any) => (
                  <div key={entry.id} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="rw-rank-number text-sm font-black text-[#2563eb]">{String(entry.position).padStart(2, '0')}</span>
                    <div>
                      <p className="text-xs font-extrabold text-[#303640]">{entry.items.title}</p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#6b7280]">{entry.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}
        </section>

        <section id="discussion" className="border-t border-[#d9dde3] pt-8">
          <div className="mb-1 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-[#2563eb]" />
            <p className="rw-kicker">Discussion</p>
          </div>
          <div className="rw-comment-shell">
            <CommentSection targetType="ranking" targetId={ranking.id} pathname={`/rankings/${ranking.slug}`} />
          </div>
        </section>

        <section id="methodology" className="border-t border-[#d9dde3] pt-9">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="rw-kicker">Methodology</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#171a1f]">이 순위가 만들어진 기준</h2>
            </div>
            {primarySource?.url && (
              <a href={primarySource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#2563eb] hover:text-[#1d4ed8]">
                대표 출처 보기 <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="overflow-hidden rounded-[14px] border border-[#d9dde3] bg-white lg:grid lg:grid-cols-3 lg:divide-x lg:divide-[#e4e7eb]">
            <div className="p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-sm font-black text-[#303640]"><Scale className="h-4 w-4 text-[#2563eb]" />평가 기준</h3>
              {ranking.criteria.length > 0 ? (
                <div className="mt-4 divide-y divide-[#edf0f3]">
                  {ranking.criteria.map((criterion: any, index: number) => (
                    <div key={criterion.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-2.5">
                        <span className="rw-rank-number mt-0.5 text-[11px] font-black text-[#2563eb]">{String(index + 1).padStart(2, '0')}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-xs font-extrabold text-[#303640]">{criterion.name}</h4>
                            {criterion.weight != null && <span className="text-[10px] font-bold text-[#8a94a3]">{criterion.weight}%</span>}
                          </div>
                          {criterion.description && <p className="mt-1 text-[11px] leading-5 text-[#737c89]">{criterion.description}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-xs text-[#8a94a3]">등록된 평가 기준이 없습니다.</p>}
            </div>

            <div className="border-t border-[#e4e7eb] p-5 sm:p-6 lg:border-t-0">
              <h3 className="flex items-center gap-2 text-sm font-black text-[#303640]"><Compass className="h-4 w-4 text-[#2563eb]" />후보 범위</h3>
              {scopeItems.length > 0 ? (
                <dl className="mt-4 space-y-3">
                  {scopeItems.map((item) => (
                    <div key={item.label}>
                      <dt className="text-[9px] font-black uppercase tracking-[0.08em] text-[#9aa3af]">{item.label}</dt>
                      <dd className="mt-1 text-[11px] font-semibold leading-5 text-[#4f5864]">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : <p className="mt-3 text-xs text-[#8a94a3]">등록된 후보 범위 설명이 없습니다.</p>}

              {ranking.facets && ranking.facets.length > 0 && (
                <div className="mt-5 border-t border-[#edf0f3] pt-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-[#6b7280]"><Tag className="h-3.5 w-3.5" />분류</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{ranking.facets.map((facet: any) => <span key={facet.id} className="rounded-md bg-[#f0f2f5] px-2 py-1 text-[9px] font-bold text-[#667085]">{facet.facet_groups?.name}: {facet.name}</span>)}</div>
                </div>
              )}
            </div>

            <div className="border-t border-[#e4e7eb] p-5 sm:p-6 lg:border-t-0">
              <h3 className="flex items-center gap-2 text-sm font-black text-[#303640]"><HelpCircle className="h-4 w-4 text-[#2563eb]" />출처</h3>
              {ranking.sources && ranking.sources.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {ranking.sources.map((source: any) => (
                    <div key={source.id}>
                      <div className="flex items-start gap-1.5">
                        <span className="text-xs font-extrabold leading-5 text-[#4f5864]">{source.label}</span>
                        {source.url && <a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`${source.label} 출처 열기`} className="mt-0.5 shrink-0 text-[#3457c8]"><ExternalLink className="h-3 w-3" /></a>}
                      </div>
                      {source.note && <p className="mt-1 text-[11px] leading-5 text-[#8a94a3]">{source.note}</p>}
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-xs text-[#8a94a3]">등록된 공개 출처가 없습니다.</p>}
            </div>
          </div>
        </section>

        {relatedRankings.length > 0 && (
          <section className="border-t border-[#d9dde3] pt-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black tracking-[-0.03em] text-[#20242a]">관련 랭킹</h2>
              <span className="text-[10px] font-bold text-[#8a929d]">다른 순위도 둘러보세요</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {relatedRankings.slice(0, 6).map((related: any) => (
                <Link key={related.id} href={`/rankings/${related.slug}`} className="group flex min-h-[84px] items-center justify-between gap-3 rounded-[12px] border border-[#e0e4e9] bg-white px-4 py-3 transition hover:border-[#a9b8df] hover:bg-[#f8faff]">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-xs font-black leading-5 text-[#303640] group-hover:text-[#2563eb]">{related.title}</p>
                    <p className="mt-1 text-[9px] font-bold text-[#9aa1aa]">{related.categories?.name || '랭킹'}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#a8b0ba] transition group-hover:translate-x-0.5 group-hover:text-[#2563eb]" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
