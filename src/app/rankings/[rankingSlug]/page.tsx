import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpRight, CalendarDays, Compass, ExternalLink, HelpCircle, Home, Network, ShieldCheck, Sparkles, Tag, Trophy } from 'lucide-react'
import { getPublicRankingBySlug, getRelatedRankings } from '@/lib/queries/public'
import { normalizeRouteSlug } from '@/lib/routing'

export const revalidate = 300

export default async function RankingDetailPage({ params }: { params: Promise<{ rankingSlug: string }> }) {
  const { rankingSlug } = await params
  const normalizedSlug = normalizeRouteSlug(rankingSlug)
  const [ranking, relatedRankings] = await Promise.all([
    getPublicRankingBySlug(normalizedSlug),
    getRelatedRankings(normalizedSlug),
  ])

  if (!ranking) notFound()

  const scopeItems = [
    ranking.scope?.region && { label: '지역', value: ranking.scope.region },
    ranking.scope?.price_range && { label: '가격대', value: ranking.scope.price_range },
    ranking.scope?.time_window && { label: '기간', value: ranking.scope.time_window },
    ranking.scope?.audience && { label: '대상', value: ranking.scope.audience },
  ].filter(Boolean) as { label: string; value: string }[]

  const updatedAt = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(ranking.updated_at))

  return (
    <div className="rw-page pb-24">
      <div className="rw-container py-8 sm:py-10">
        <header className="border-b border-[#dde2e8] pb-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#8a94a3]">
            <Link href="/" className="transition hover:text-[#3457c8]"><Home className="mr-1 inline h-3.5 w-3.5" />홈</Link>
            <span>/</span>
            <Link href={`/categories/${ranking.categories.slug}`} className="transition hover:text-[#3457c8]">{ranking.categories.name}</Link>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className="rounded-lg bg-[#eef2ff] px-2.5 py-1.5 text-[#3457c8]">에디터 선정</span>
            <span className="inline-flex items-center gap-1.5 text-[#8a94a3]"><CalendarDays className="h-3.5 w-3.5" />{updatedAt} 업데이트</span>
          </div>
          <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-[-0.035em] text-[#171a1f] sm:text-5xl">{ranking.title}</h1>
          {ranking.summary && <p className="mt-4 max-w-3xl text-sm leading-7 text-[#5f6875] sm:text-base">{ranking.summary}</p>}
        </header>

        <section className="py-9">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <div className="flex items-end justify-between gap-4">
                <div><p className="rw-kicker">Ranking</p><h2 className="mt-2 text-2xl font-black text-[#171a1f]">순위</h2></div>
                <span className="text-xs font-semibold text-[#8a94a3]">총 {ranking.entries.length}개 항목</span>
              </div>

              <div className="mt-5 space-y-3">
                {ranking.entries.map((entry: any, index: number) => (
                  <article key={entry.id} className={`rw-surface rounded-[20px] p-4 sm:p-5 ${index === 0 ? 'border-[#d4b56b] shadow-[0_12px_34px_rgba(161,98,7,0.08)]' : ''}`}>
                    {entry.is_sponsored && <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-[#ead9ad] bg-[#fffbeb] px-2.5 py-1 text-[9px] font-black tracking-[0.08em] text-[#8a5a08]"><Sparkles className="h-3 w-3" />스폰서 표기</div>}
                    <div className="grid gap-4 sm:grid-cols-[58px_88px_minmax(0,1fr)] sm:items-start sm:gap-5">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg font-black ${index === 0 ? 'bg-[#fff8e7] text-[#9a660b]' : 'bg-[#f0f2f5] text-[#4f5864]'}`}>{entry.position}</div>
                      {entry.items.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.items.image_url} alt={entry.items.title} className="h-20 w-20 rounded-xl object-cover ring-1 ring-[#e3e7ec]" />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[#f0f2f5] text-[#9aa3af]"><Trophy className="h-5 w-5" /></div>
                      )}
                      <div className="min-w-0 pr-0 sm:pr-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/items/${entry.items.slug}`} className="group inline-flex max-w-full items-center gap-1.5">
                              <h3 className="truncate text-base font-extrabold text-[#171a1f] transition group-hover:text-[#2445ad]">{entry.items.title}</h3>
                              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#8a94a3] transition group-hover:text-[#3457c8]" />
                            </Link>
                            {entry.items.brand_or_creator && <p className="mt-0.5 text-xs font-semibold text-[#8a94a3]">{entry.items.brand_or_creator}</p>}
                          </div>
                          {entry.score != null && <div className="rounded-lg bg-[#f0f2f5] px-2.5 py-1.5 text-xs font-black text-[#4f5864]">{Number(entry.score).toFixed(1)}</div>}
                        </div>
                        {entry.note && <p className="mt-3 text-sm leading-6 text-[#4f5864]">{entry.note}</p>}
                        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold">
                          <Link href={`/items/${entry.items.slug}`} className="rounded-lg border border-[#d8dee6] bg-white px-2.5 py-1.5 text-[#4f5864] transition hover:border-[#9caddd] hover:text-[#2445ad]">아이템 상세 보기</Link>
                          {entry.items.official_url && <a href={entry.items.official_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[#d8dee6] bg-white px-2.5 py-1.5 text-[#4f5864] transition hover:border-[#9caddd] hover:text-[#2445ad]">공식 사이트 <ExternalLink className="ml-1 inline h-3 w-3" /></a>}
                          {entry.items.affiliate_url && <a href={entry.items.affiliate_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[#d8dee6] bg-white px-2.5 py-1.5 text-[#4f5864] transition hover:border-[#9caddd] hover:text-[#2445ad]">구매 정보 <ExternalLink className="ml-1 inline h-3 w-3" /></a>}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="rw-surface rw-card p-5">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#303640]"><ShieldCheck className="h-4 w-4 text-[#3457c8]" />문서 정보</h3>
                <dl className="mt-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-3"><dt className="text-[#8a94a3]">상태</dt><dd className="font-bold text-[#4f5864]">{ranking.status === 'published' ? '공개' : ranking.status}</dd></div>
                  <div className="flex items-center justify-between gap-3"><dt className="text-[#8a94a3]">카테고리</dt><dd className="font-bold text-[#4f5864]">{ranking.categories.name}</dd></div>
                  <div className="flex items-center justify-between gap-3"><dt className="text-[#8a94a3]">업데이트</dt><dd className="font-bold text-[#4f5864]">{updatedAt}</dd></div>
                </dl>
              </div>

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

        <section className="border-t border-[#dde2e8] py-9">
          <div className="mb-5"><p className="rw-kicker">Methodology</p><h2 className="mt-2 text-2xl font-black text-[#171a1f]">이 순위가 만들어진 기준</h2></div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rw-surface rw-card p-5 sm:p-6">
              <h3 className="text-sm font-extrabold text-[#303640]">평가 기준</h3>
              <div className="mt-4 divide-y divide-[#edf0f3]">
                {ranking.criteria?.length ? ranking.criteria.map((criterion: any, index: number) => (
                  <div key={criterion.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#eef2ff] text-[10px] font-black text-[#3457c8]">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-extrabold text-[#303640]">{criterion.label}</h4>{criterion.weight != null && <span className="text-[10px] font-bold text-[#8a94a3]">가중치 {criterion.weight}</span>}</div>
                      {criterion.description && <p className="mt-1 text-xs leading-6 text-[#737c89]">{criterion.description}</p>}
                    </div>
                  </div>
                )) : <p className="text-xs leading-6 text-[#8a94a3]">등록된 평가 기준이 없습니다.</p>}
              </div>
            </div>

            <div className="space-y-4">
              {ranking.methodology && <div className="rw-surface rw-card p-5"><h3 className="text-sm font-extrabold text-[#303640]">방법론</h3><p className="mt-3 text-xs leading-6 text-[#5f6875]">{ranking.methodology}</p></div>}
              {ranking.disclaimer && <div className="rounded-[18px] border border-[#ead9ad] bg-[#fffbeb] p-5"><h3 className="text-sm font-extrabold text-[#805600]">주의사항</h3><p className="mt-3 text-xs leading-6 text-[#6f570f]">{ranking.disclaimer}</p></div>}
            </div>
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
