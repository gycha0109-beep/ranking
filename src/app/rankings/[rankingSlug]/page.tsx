import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublishedRankingBySlug, getRelatedRankings } from '@/lib/queries/public'
import { getRankingSponsorshipDisclosures } from '@/lib/queries/sponsorships'
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

function getBasisDate(scope: Record<string, unknown> | null | undefined, fallback: string) {
  const period = typeof scope?.period === 'string' ? scope.period : ''
  const match = period.match(/\d{4}-\d{2}-\d{2}/)
  const value = match?.[0] || fallback
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ko-KR')
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

function podiumOrderClass(position: number) {
  if (position === 1) return 'order-1 md:order-2 md:-mt-5'
  if (position === 2) return 'order-2 md:order-1'
  return 'order-3'
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
  const podiumEntries = topEntries.filter((entry: any) => entry.position <= 3)
  const followingEntries = topEntries.filter((entry: any) => entry.position > 3)
  const primarySource = ranking.sources.find((source: any) => source.url) || ranking.sources[0]
  const relatedVideo = ranking.sources.find((source: any) => isVideoSource(source.url))
  const publishedOrUpdated = ranking.published_at || ranking.updated_at
  const basisDate = getBasisDate(ranking.scope_json, publishedOrUpdated)

  return (
    <div className="rw-page pb-16 sm:pb-20">
      <header className="border-b border-[#dfe3e8] bg-white">
        <div className="rw-container max-w-[1120px] py-7 sm:py-9 lg:py-11">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#8a94a3]">
            <Link href="/" className="hover:text-[#2445ad]">홈</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/categories/${ranking.categories?.slug}`} className="hover:text-[#2445ad]">{ranking.categories?.name}</Link>
            {ranking.subcategories && <><ChevronRight className="h-3.5 w-3.5" /><Link href={`/categories/${ranking.categories?.slug}/${ranking.subcategories.slug}`} className="hover:text-[#2445ad]">{ranking.subcategories.name}</Link></>}
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(480px,1.12fr)] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold">
                <span className="text-[#3158e8]">{ranking.categories?.name}</span>
                {ranking.subcategories?.name && <><span className="text-[#b3bac4]">·</span><span className="text-[#3158e8]">{ranking.subcategories.name}</span></>}
                <span className="rounded-md bg-[#eef2ff] px-2 py-1 text-[10px] text-[#3457c8]">{getRankingTypeName(ranking.ranking_type)}</span>
              </div>

              <h1 className="rw-display mt-4 text-[34px] font-black leading-[1.08] tracking-[-0.05em] text-[#11151b] sm:text-[46px] lg:text-[50px]">
                {ranking.title}
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-[#5f6875] sm:text-[15px]">{ranking.summary}</p>

              <div className="mt-6 grid gap-3 border-y border-[#e4e7eb] py-4 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#8a94a3]">기준일</p>
                  <p className="mt-1 text-xs font-extrabold text-[#303640]">{basisDate}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#8a94a3]">출처</p>
                  <p className="mt-1 line-clamp-1 text-xs font-extrabold text-[#303640]">{primarySource?.label || '공개 출처'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#8a94a3]">최근 업데이트</p>
                  <p className="mt-1 text-xs font-extrabold text-[#303640]">{new Date(ranking.updated_at).toLocaleDateString('ko-KR')}</p>
                </div>
              </div>

              {rankingDisclosures.length > 0 && <div className="mt-5"><SponsorshipDisclosure disclosures={rankingDisclosures} /></div>}
            </div>

            {podiumEntries.length > 0 && (
              <div className="min-w-0">
                <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
                  {podiumEntries.map((entry: any) => {
                    const item = entry.items
                    const first = entry.position === 1
                    const metric = getHeroMetric(entry, ranking.ranking_type)

                    return (
                      <Link
                        key={entry.id}
                        href={`/items/${item.slug}`}
                        className={`${podiumOrderClass(entry.position)} group relative flex min-h-[190px] flex-col overflow-hidden rounded-[18px] border p-3 transition hover:-translate-y-0.5 hover:shadow-[0_12px_34px_rgba(20,35,70,0.12)] sm:min-h-[230px] sm:p-5 ${first ? 'border-[#3158e8] bg-[#174bd8] text-white shadow-[0_16px_42px_rgba(34,79,211,0.22)]' : 'border-[#dce1e8] bg-[#fbfcfe] text-[#20242a]'}`}
                      >
                        <span className={`rw-rank-number text-3xl font-black leading-none sm:text-5xl ${first ? 'text-white' : 'text-[#4f5864]'}`}>{String(entry.position).padStart(2, '0')}</span>
                        <div className={`mt-5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border sm:h-16 sm:w-16 ${first ? 'border-white/30 bg-white/10' : 'border-[#e0e4e9] bg-[#f0f3f7]'}`}>
                          {item.image_url ? (
                            <SafeImage src={item.image_url} alt={item.title} fallbackSrc="/globe.svg" className="h-full w-full object-cover" />
                          ) : (
                            <span className={`text-sm font-black ${first ? 'text-white' : 'text-[#3158e8]'}`}>{item.title.slice(0, 2)}</span>
                          )}
                        </div>
                        <div className="mt-auto pt-4">
                          <h2 className={`line-clamp-2 text-sm font-black leading-5 tracking-[-0.02em] sm:text-base sm:leading-6 ${first ? 'text-white' : 'text-[#20242a]'}`}>{item.title}</h2>
                          {metric && <p className={`mt-2 text-xs font-extrabold ${first ? 'text-[#dfe8ff]' : 'text-[#3158e8]'}`}>{metric.value}</p>}
                        </div>
                      </Link>
                    )
                  })}
                </div>

                {followingEntries.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-[14px] border border-[#dfe3e8] bg-white">
                    {followingEntries.map((entry: any) => {
                      const item = entry.items
                      const metric = getHeroMetric(entry, ranking.ranking_type)
                      return (
                        <Link key={entry.id} href={`/items/${item.slug}`} className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#edf0f3] px-4 py-3 last:border-b-0 hover:bg-[#f8faff]">
                          <span className="rw-rank-number text-sm font-black text-[#303640]">{String(entry.position).padStart(2, '0')}</span>
                          <span className="line-clamp-1 text-xs font-extrabold text-[#303640]">{item.title}</span>
                          {metric && <span className="text-[11px] font-black text-[#3158e8]">{metric.value}</span>}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="rw-container max-w-[1120px] space-y-9 pt-8 sm:space-y-11 sm:pt-10">
        <section className={`grid gap-4 ${relatedVideo ? 'lg:grid-cols-[1.2fr_0.8fr]' : 'lg:grid-cols-2'}`}>
          <article className="border-l-4 border-[#3158e8] bg-white px-5 py-5 shadow-[0_4px_20px_rgba(20,27,36,0.04)] sm:px-6">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-[#3158e8]" />
              <h2 className="text-sm font-black text-[#20242a]">에디터 노트</h2>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#4f5864]">{ranking.body || ranking.summary}</p>
          </article>

          {relatedVideo ? (
            <a href={relatedVideo.url} target="_blank" rel="noopener noreferrer" className="group flex min-h-[170px] flex-col justify-between border border-[#dfe3e8] bg-[#15191f] p-5 text-white transition hover:border-[#3158e8] sm:p-6">
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
            <article className="border border-[#dfe3e8] bg-white p-5 sm:p-6">
              <h2 className="text-sm font-black text-[#20242a]">이번 랭킹 포인트</h2>
              <div className="mt-4 divide-y divide-[#edf0f3]">
                {topEntries.slice(0, 3).map((entry: any) => (
                  <div key={entry.id} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="rw-rank-number text-sm font-black text-[#3158e8]">{String(entry.position).padStart(2, '0')}</span>
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

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="rw-kicker">Full ranking</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#171a1f]">순위</h2>
            </div>
            <span className="text-xs font-semibold text-[#8a94a3]">총 {ranking.entries.length}개 항목</span>
          </div>

          <ol className="overflow-hidden border-y border-[#cfd5dd] bg-white">
            {ranking.entries.map((entry: any) => {
              const item = entry.items
              if (!item) return null
              const displayScores = getDisplayScores(entry)
              const disclosures = placementDisclosures.filter((disclosure) => disclosure.item_id === item.id)

              return (
                <li key={entry.id} className="border-b border-[#e6e9ed] last:border-b-0">
                  <div className="grid gap-3 px-3 py-4 sm:px-5 md:grid-cols-[54px_64px_minmax(0,1fr)_minmax(150px,auto)] md:items-center md:gap-4">
                    <div className={`rw-rank-number flex h-10 w-10 items-center justify-center rounded-lg text-lg font-black ${entry.position === 1 ? 'bg-[#3158e8] text-white' : entry.position <= 3 ? 'bg-[#eef2ff] text-[#3158e8]' : 'bg-[#f1f3f5] text-[#4f5864]'}`}>
                      {entry.position}
                    </div>

                    <div className="hidden h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-[#e0e4e9] bg-[#f3f5f7] md:flex">
                      {item.image_url ? (
                        <SafeImage src={item.image_url} alt={item.title} fallbackSrc="/globe.svg" className="h-full w-full object-cover" />
                      ) : (
                        <Award className="h-5 w-5 text-[#9aa3af]" />
                      )}
                    </div>

                    <div className="min-w-0 md:col-auto">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link href={`/items/${item.slug}`} className="group inline-flex min-w-0 items-center gap-1">
                          <h3 className="line-clamp-1 text-sm font-black text-[#20242a] transition group-hover:text-[#2445ad] sm:text-[15px]">{item.title}</h3>
                          <ChevronRight className="h-4 w-4 shrink-0 text-[#a8b0ba] group-hover:text-[#3158e8]" />
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
                        <span key={`${entry.id}-${index}`} className="inline-flex items-center gap-1.5 bg-[#f5f7fa] px-2.5 py-1.5 text-[10px]">
                          <span className="text-[#6b7280]">{scoreObj.criterion}</span>
                          <strong className="font-black text-[#303640]">{String(scoreObj.score)}</strong>
                        </span>
                      ))}
                      {item.external_url && <a href={item.external_url} target="_blank" rel="noopener noreferrer" aria-label={`${item.title} 공식 사이트 열기`} className="inline-flex h-8 w-8 items-center justify-center border border-[#d7dce2] text-[#6b7280] hover:border-[#3158e8] hover:text-[#3158e8]"><ExternalLink className="h-3.5 w-3.5" /></a>}
                      {item.affiliate_url && <a href={item.affiliate_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 border border-[#cbd5f5] bg-[#eef2ff] px-2.5 py-1.5 text-[10px] font-extrabold text-[#3457c8]">구매 정보 <ExternalLink className="h-3 w-3" /></a>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <section id="discussion" className="border-t border-[#d9dde3] pt-8">
          <div className="mb-1 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-[#3158e8]" />
            <p className="rw-kicker">Discussion</p>
          </div>
          <div className="rw-comment-shell">
            <CommentSection targetType="ranking" targetId={ranking.id} pathname={`/rankings/${ranking.slug}`} />
          </div>
        </section>

        <section className="border-t border-[#d9dde3] pt-9">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="rw-kicker">Methodology</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#171a1f]">이 순위가 만들어진 기준</h2>
            </div>
            {primarySource?.url && (
              <a href={primarySource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#3158e8] hover:text-[#2445ad]">
                대표 출처 보기 <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="overflow-hidden border border-[#d9dde3] bg-white lg:grid lg:grid-cols-3 lg:divide-x lg:divide-[#e4e7eb]">
            <div className="p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-sm font-black text-[#303640]"><Scale className="h-4 w-4 text-[#3158e8]" />평가 기준</h3>
              {ranking.criteria.length > 0 ? (
                <div className="mt-4 divide-y divide-[#edf0f3]">
                  {ranking.criteria.map((criterion: any, index: number) => (
                    <div key={criterion.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-2.5">
                        <span className="rw-rank-number mt-0.5 text-[11px] font-black text-[#3158e8]">{String(index + 1).padStart(2, '0')}</span>
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
              <h3 className="flex items-center gap-2 text-sm font-black text-[#303640]"><Compass className="h-4 w-4 text-[#3158e8]" />후보 범위</h3>
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
                  <div className="mt-2 flex flex-wrap gap-1.5">{ranking.facets.map((facet: any) => <span key={facet.id} className="bg-[#f0f2f5] px-2 py-1 text-[9px] font-bold text-[#667085]">{facet.facet_groups?.name}: {facet.name}</span>)}</div>
                </div>
              )}
            </div>

            <div className="border-t border-[#e4e7eb] p-5 sm:p-6 lg:border-t-0">
              <h3 className="flex items-center gap-2 text-sm font-black text-[#303640]"><HelpCircle className="h-4 w-4 text-[#3158e8]" />출처</h3>
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
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <span className="shrink-0 text-xs font-black text-[#303640]">관련 랭킹</span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-2">
                {relatedRankings.slice(0, 5).map((related: any) => (
                  <Link key={related.id} href={`/rankings/${related.slug}`} className="group inline-flex items-center gap-1 text-xs font-semibold text-[#5f6875] hover:text-[#3158e8]">
                    <span className="line-clamp-1">{related.title}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
