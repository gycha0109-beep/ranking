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
  Network,
  Scale,
  Star,
  Tag,
} from 'lucide-react'
import SafeImage from '@/components/SafeImage'
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
    user_vote: '사용자 투표',
    sponsored: '스폰서십',
  }
  return map[type] || type
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

  return (
    <div className="rw-page pb-20">
      <header className="border-b border-[#e3e7ec] bg-white">
        <div className="rw-reading py-8 sm:py-10">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#8a94a3]">
            <Link href="/" className="hover:text-[#2445ad]">홈</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/categories/${ranking.categories?.slug}`} className="hover:text-[#2445ad]">{ranking.categories?.name}</Link>
            {ranking.subcategories && <><ChevronRight className="h-3.5 w-3.5" /><Link href={`/categories/${ranking.categories?.slug}/${ranking.subcategories.slug}`} className="hover:text-[#2445ad]">{ranking.subcategories.name}</Link></>}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className="rounded-lg bg-[#eef2ff] px-2.5 py-1.5 text-[#3457c8]">{getRankingTypeName(ranking.ranking_type)}</span>
            <span className="inline-flex items-center gap-1.5 text-[#8a94a3]"><CalendarDays className="h-3.5 w-3.5" />{new Date(ranking.published_at || ranking.updated_at).toLocaleDateString('ko-KR')} 업데이트</span>
          </div>

          <h1 className="mt-4 text-3xl font-black leading-[1.2] tracking-[-0.045em] text-[#171a1f] sm:text-4xl">{ranking.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#5f6875] sm:text-base">{ranking.summary}</p>
          {rankingDisclosures.length > 0 && <div className="mt-5"><SponsorshipDisclosure disclosures={rankingDisclosures} /></div>}
        </div>
      </header>

      <div className="rw-reading space-y-12 pt-8 sm:pt-10">
        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="rw-kicker">Ranking</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#171a1f]">순위</h2>
            </div>
            <span className="text-xs font-semibold text-[#8a94a3]">총 {ranking.entries.length}개 항목</span>
          </div>

          <div className="space-y-3">
            {ranking.entries.map((entry: any) => {
              const item = entry.items
              if (!item) return null
              const topThree = entry.position <= 3
              const disclosures = placementDisclosures.filter((disclosure) => disclosure.item_id === item.id)

              return (
                <article key={entry.id} className={`relative overflow-hidden rounded-[20px] border bg-white p-5 sm:p-6 ${entry.position === 1 ? 'border-[#d4b56b]' : 'border-[#dde2e8]'}`}>
                  <div className="grid gap-5 sm:grid-cols-[58px_88px_minmax(0,1fr)] sm:items-start">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl font-black ${topThree ? 'bg-[#171a1f] text-white' : 'bg-[#f0f2f5] text-[#667085]'}`}>
                      {entry.position}
                    </div>

                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-[#e4e8ed] bg-[#f3f5f7] sm:h-[88px] sm:w-[88px]">
                      {item.image_url ? (
                        <SafeImage src={item.image_url} alt={item.title} className="h-full w-full object-cover" fallbackSrc="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=180" />
                      ) : (
                        <Award className="h-6 w-6 text-[#a4acb7]" />
                      )}
                    </div>

                    <div className="min-w-0 pr-0 sm:pr-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link href={`/items/${item.slug}`} className="group inline-flex items-center gap-1">
                            <h3 className="text-lg font-black tracking-[-0.025em] text-[#20242a] transition group-hover:text-[#2445ad]">{item.title}</h3>
                            <ChevronRight className="h-4 w-4 text-[#b1b8c2] group-hover:text-[#3457c8]" />
                          </Link>
                          {item.brand_or_creator && <p className="mt-0.5 text-xs font-semibold text-[#8a94a3]">{item.brand_or_creator}</p>}
                        </div>
                        {entry.editor_score && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#fff7e6] px-2.5 py-1.5 text-xs font-extrabold text-[#8f650f]"><Star className="h-3.5 w-3.5 fill-current" />{Number(entry.editor_score).toFixed(1)}</span>
                        )}
                      </div>

                      <p className="mt-3 text-sm leading-7 text-[#4f5864]">{entry.reason}</p>
                      {disclosures.length > 0 && <div className="mt-4"><SponsorshipDisclosure disclosures={disclosures} compact /></div>}

                      {entry.score_json?.scores && entry.score_json.scores.length > 0 && (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {entry.score_json.scores.map((scoreObj: any, sIdx: number) => (
                            <div key={sIdx} className="flex items-center justify-between rounded-lg bg-[#f6f7f9] px-3 py-2 text-[11px]">
                              <span className="text-[#6b7280]">{scoreObj.criterion}</span>
                              <span className="font-extrabold text-[#303640]">{scoreObj.score}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#edf0f3] pt-3">
                        <Link href={`/items/${item.slug}`} className="text-[11px] font-extrabold text-[#3457c8] hover:text-[#2445ad]">아이템 상세 보기</Link>
                        {item.external_url && <a href={item.external_url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-[#6b7280] hover:text-[#2445ad]">공식 사이트 <ExternalLink className="h-3 w-3" /></a>}
                        {item.affiliate_url && <a href={item.affiliate_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[#cbd5f5] bg-[#eef2ff] px-2.5 py-1.5 text-[10px] font-extrabold text-[#3457c8]">구매 정보 <ExternalLink className="h-3 w-3" /></a>}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="border-t border-[#dde2e8] pt-10">
          <div className="mb-5">
            <p className="rw-kicker">Methodology</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#171a1f]">이 순위가 만들어진 기준</h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="space-y-4">
              {ranking.body && (
                <div className="rw-surface rw-card p-5 sm:p-6">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#303640]"><Info className="h-4 w-4 text-[#3457c8]" />분석 요약</h3>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#5f6875]">{ranking.body}</div>
                </div>
              )}

              <div className="rw-surface rw-card p-5 sm:p-6">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#303640]"><Scale className="h-4 w-4 text-[#3457c8]" />평가 기준</h3>
                <div className="mt-4 divide-y divide-[#edf0f3]">
                  {ranking.criteria.map((criterion: any, index: number) => (
                    <div key={criterion.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f0f2f5] text-xs font-black text-[#667085]">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-extrabold text-[#303640]">{criterion.name}</h4>
                          {criterion.weight && <span className="text-[10px] font-bold text-[#8a94a3]">가중치 {criterion.weight}%</span>}
                        </div>
                        {criterion.description && <p className="mt-1 text-xs leading-6 text-[#737c89]">{criterion.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rw-surface rw-card p-5">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#303640]"><Compass className="h-4 w-4 text-[#3457c8]" />후보 범위</h3>
                {scopeItems.length > 0 ? (
                  <dl className="mt-4 space-y-3">
                    {scopeItems.map((item) => <div key={item.label} className="border-b border-[#edf0f3] pb-3 last:border-0 last:pb-0"><dt className="text-[10px] font-extrabold text-[#9aa3af]">{item.label}</dt><dd className="mt-1 text-xs font-bold text-[#4f5864]">{item.value}</dd></div>)}
                  </dl>
                ) : <p className="mt-3 text-xs text-[#8a94a3]">등록된 후보 범위 설명이 없습니다.</p>}
              </div>

              {ranking.facets && ranking.facets.length > 0 && (
                <div className="rw-surface rw-card p-5">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#303640]"><Tag className="h-4 w-4 text-[#3457c8]" />분류</h3>
                  <div className="mt-3 flex flex-wrap gap-2">{ranking.facets.map((facet: any) => <span key={facet.id} className="rounded-lg bg-[#f0f2f5] px-2.5 py-1.5 text-[10px] font-bold text-[#667085]">{facet.facet_groups?.name}: {facet.name}</span>)}</div>
                </div>
              )}

              {ranking.sources && ranking.sources.length > 0 && (
                <div className="rw-surface rw-card p-5">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#303640]"><HelpCircle className="h-4 w-4 text-[#3457c8]" />출처</h3>
                  <div className="mt-3 space-y-3">{ranking.sources.map((source: any) => <div key={source.id}><div className="flex items-center gap-1.5"><span className="text-xs font-extrabold text-[#4f5864]">{source.label}</span>{source.url && <a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`${source.label} 출처 열기`} className="text-[#3457c8]"><ExternalLink className="h-3 w-3" /></a>}</div>{source.note && <p className="mt-1 text-[11px] leading-5 text-[#8a94a3]">{source.note}</p>}</div>)}</div>
                </div>
              )}
            </aside>
          </div>
        </section>

        {relatedRankings.length > 0 && (
          <section className="border-t border-[#dde2e8] pt-10">
            <div className="mb-5 flex items-center justify-between gap-4"><div><p className="rw-kicker">Connections</p><h2 className="mt-2 text-xl font-black text-[#171a1f]">관련 랭킹</h2></div><Network className="h-5 w-5 text-[#8a94a3]" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedRankings.map((related: any) => (
                <Link key={related.id} href={`/rankings/${related.slug}`} className="rw-surface rw-card rw-card-interactive group p-5">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#8a94a3]"><span className="text-[#3457c8]">{related.related_reason}</span><span>·</span><span>{related.categories?.name}</span></div>
                  <h3 className="mt-2 line-clamp-2 text-sm font-extrabold leading-6 text-[#303640] transition group-hover:text-[#2445ad]">{related.title}</h3>
                  <p className="mt-2 line-clamp-2 text-xs leading-6 text-[#7b8491]">{related.summary}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
