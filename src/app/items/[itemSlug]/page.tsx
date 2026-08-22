import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ChevronRight,
  ExternalLink,
  Info,
  Layers,
  MessageCircle,
  Network,
  ShieldAlert,
  Tag,
  Trophy,
} from 'lucide-react'
import CommentSection from '@/components/comments/CommentSection'
import SafeImage from '@/components/SafeImage'
import SponsorshipDisclosure from '@/components/sponsorship/SponsorshipDisclosure'
import { buildPublicItemFacts, formatItemMachineLabel } from '@/lib/item-metadata'
import { getItemBySlug, getRankingsContainingItem, getRelatedItems } from '@/lib/queries/public'
import { getItemSponsorshipDisclosures } from '@/lib/queries/sponsorships'

interface Props {
  params: Promise<{ itemSlug: string }>
}

function ItemHeroVisual({ src, alt, initials }: { src?: string | null; alt: string; initials: string }) {
  if (!src) {
    return (
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_26%,rgba(96,133,255,0.82),transparent_32%),linear-gradient(135deg,#141a25_0%,#223765_55%,#1d55dc_100%)]">
        <span className="absolute bottom-7 right-7 text-[5.5rem] font-black leading-none tracking-[-0.08em] text-white/12 sm:text-[8rem]">{initials}</span>
      </div>
    )
  }

  return (
    <SafeImage
      src={src}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.015]"
      fallbackSrc="/item-placeholder.svg"
    />
  )
}

export default async function ItemDetailPage({ params }: Props) {
  const { itemSlug } = await params
  const item = await getItemBySlug(itemSlug)
  if (!item) notFound()

  const [rankings, relatedItems, sponsorshipDisclosures] = await Promise.all([
    getRankingsContainingItem(item.id),
    getRelatedItems(item),
    getItemSponsorshipDisclosures(item.id),
  ])

  const facts = buildPublicItemFacts(item.metadata)
  const hasStructuredInfo = facts.length > 0 || (item.facets?.length || 0) > 0
  const itemTypeLabel = formatItemMachineLabel(item.item_type)
  const initials = item.title.trim().slice(0, 2) || 'RW'
  const contextualRelatedItems = relatedItems.filter((related: any) => related.related_reason !== '같은 카테고리')
  const rankedMemberships = rankings.filter((ranking: any) => Number.isFinite(Number(ranking.position)))
  const bestPosition = rankedMemberships.length > 0
    ? Math.min(...rankedMemberships.map((ranking: any) => Number(ranking.position)))
    : null
  const topThreeCount = rankedMemberships.filter((ranking: any) => Number(ranking.position) <= 3).length
  const orderedRankings = [...rankings].sort((a: any, b: any) => Number(a.position) - Number(b.position))
  const leadRanking = orderedRankings[0] || null

  return (
    <div className="rw-page bg-white pb-16 sm:pb-20">
      <header className="border-b border-[#e4e7eb] bg-white">
        <div className="rw-container max-w-[1160px] py-6 sm:py-8 lg:py-10">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8a929d] sm:text-xs">
            <Link href="/" className="hover:text-[#2563eb]">홈</Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span>아이템</span>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-[10px] font-black sm:mt-6">
            <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-[#1d4ed8]">{itemTypeLabel}</span>
            {item.brand_or_creator && <span className="text-[#747d89]">{item.brand_or_creator}</span>}
          </div>
          <h1 className="rw-display mt-3 text-[2.4rem] font-black leading-[1.02] tracking-[-0.06em] text-[#111318] sm:text-[3.3rem] lg:text-[3.9rem]">{item.title}</h1>
          {item.description && <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-[#626b77] sm:text-[15px]">{item.description}</p>}

          {sponsorshipDisclosures.length > 0 && (
            <div className="mt-5"><SponsorshipDisclosure disclosures={sponsorshipDisclosures} /></div>
          )}

          <div className="mt-6 grid gap-3 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_310px]">
            <div className="group relative min-h-[360px] overflow-hidden rounded-[18px] bg-[#15191f] text-white shadow-[0_18px_42px_rgba(17,24,39,0.13)] sm:min-h-[430px]">
              <ItemHeroVisual src={item.image_url} alt={item.title} initials={initials} />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,11,17,0.84)_0%,rgba(8,11,17,0.48)_48%,rgba(8,11,17,0.12)_100%)]" />
              <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/82 via-black/35 to-transparent" />

              <div className="relative z-10 flex min-h-[360px] flex-col p-5 sm:min-h-[430px] sm:p-7 lg:p-8">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/65">Ranking footprint</span>
                  {item.external_url && (
                    <a href={item.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white/92 px-3 py-1.5 text-[10px] font-black text-[#20242a] hover:bg-white">
                      공식 사이트 <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </div>

                <div className="mt-auto max-w-[720px] pt-14">
                  {leadRanking ? (
                    <Link href={`/rankings/${leadRanking.slug}`} className="block">
                      <p className="text-xs font-bold text-white/68">공개 랭킹 내 최고 순위</p>
                      <div className="mt-2 flex items-end gap-4 sm:gap-5">
                        <span className="rw-rank-number text-[5.2rem] font-black leading-[0.75] tracking-[-0.09em] sm:text-[8rem]">#{bestPosition}</span>
                        <div className="min-w-0 pb-1 sm:pb-2">
                          <p className="line-clamp-2 text-lg font-black leading-6 tracking-[-0.035em] sm:text-2xl">{leadRanking.title}</p>
                          <p className="mt-2 text-[10px] font-bold text-white/62">{leadRanking.categories?.name || '랭킹'}{leadRanking.subcategories?.name ? ` · ${leadRanking.subcategories.name}` : ''}</p>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-white/68">아직 공개 랭킹 기록이 없습니다</p>
                      <p className="mt-3 max-w-md text-2xl font-black tracking-[-0.04em]">첫 랭킹 등재를 기다리고 있습니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <aside className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[14px] border border-[#dfe3e8] bg-white p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#8a929d]">Best rank</p>
                <p className="rw-rank-number mt-3 text-[3rem] font-black leading-none tracking-[-0.07em] text-[#2563eb]">{bestPosition != null ? `#${bestPosition}` : '—'}</p>
                <p className="mt-2 text-[11px] font-bold text-[#69717c]">공개 랭킹 최고 순위</p>
              </div>
              <div className="rounded-[14px] border border-[#dfe3e8] bg-white p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#8a929d]">Appearances</p>
                <p className="rw-rank-number mt-3 text-[3rem] font-black leading-none tracking-[-0.07em] text-[#252a32]">{rankings.length}</p>
                <p className="mt-2 text-[11px] font-bold text-[#69717c]">등장하는 공개 랭킹</p>
              </div>
              <div className="rounded-[14px] border border-[#dfe3e8] bg-[#f7f9fc] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#8a929d]">Top 3</p>
                <p className="rw-rank-number mt-3 text-[3rem] font-black leading-none tracking-[-0.07em] text-[#252a32]">{topThreeCount}</p>
                <p className="mt-2 text-[11px] font-bold text-[#69717c]">TOP3에 든 공개 랭킹</p>
              </div>
            </aside>
          </div>

          {item.affiliate_url && (
            <div className="mt-3 flex justify-end">
              <a href={item.affiliate_url} target="_blank" rel="noopener noreferrer" className="rw-button-primary px-4 text-xs">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />구매 정보
              </a>
            </div>
          )}
        </div>
      </header>

      <div className="rw-container max-w-[1160px] space-y-10 pt-8 sm:space-y-12 sm:pt-10">
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="rw-kicker">Where it ranks</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#171a1f]">이 항목은 어디에서 몇 등인가요?</h2>
            </div>
            <span className="text-xs font-semibold text-[#8a94a3]">{rankings.length}개 공개 랭킹</span>
          </div>

          {orderedRankings.length > 0 ? (
            <ol className="overflow-hidden rounded-[14px] border border-[#dfe3e8] bg-white">
              {orderedRankings.map((ranking: any) => (
                <li key={ranking.id} className="border-b border-[#e8ebef] last:border-b-0">
                  <Link href={`/rankings/${ranking.slug}`} className="group grid gap-3 px-4 py-4 transition hover:bg-[#f8faff] sm:grid-cols-[74px_minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-5">
                    <span className={`rw-rank-number text-[2.35rem] font-black leading-none tracking-[-0.06em] ${Number(ranking.position) <= 3 ? 'text-[#2563eb]' : 'text-[#59616c]'}`}>#{ranking.position}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#8a94a3]">
                        {ranking.categories?.name && <span className="text-[#3457c8]">{ranking.categories.name}</span>}
                        {ranking.subcategories?.name && <><span>·</span><span>{ranking.subcategories.name}</span></>}
                      </div>
                      <h3 className="mt-1 line-clamp-1 text-sm font-black tracking-[-0.02em] text-[#303640] transition group-hover:text-[#2563eb] sm:text-[15px]">{ranking.title}</h3>
                      {ranking.summary && <p className="mt-1 line-clamp-1 text-xs text-[#737c89]">{ranking.summary}</p>}
                    </div>
                    <ChevronRight className="hidden h-4 w-4 text-[#aab2bd] transition group-hover:translate-x-0.5 group-hover:text-[#2563eb] sm:block" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-[14px] border border-[#dfe3e8] bg-white px-6 py-12 text-center">
              <ShieldAlert className="mx-auto h-7 w-7 text-[#8a94a3]" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-extrabold text-[#3f4752]">아직 공개 랭킹에 등재되지 않았습니다</h3>
              <p className="mt-2 text-xs text-[#737c89]">이 아이템이 포함된 랭킹이 발행되면 이곳에 표시됩니다.</p>
            </div>
          )}
        </section>

        {hasStructuredInfo && (
          <section className="border-t border-[#d9dde3] pt-9">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="rw-kicker">Item facts</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#171a1f]">기본 정보</h2>
              </div>
              <Trophy className="h-5 w-5 text-[#8a94a3]" aria-hidden="true" />
            </div>

            {facts.length > 0 && (
              <dl className="grid overflow-hidden rounded-[14px] border border-[#dfe3e8] bg-white sm:grid-cols-2 lg:grid-cols-4">
                {facts.map((fact) => (
                  <div key={fact.key} className="min-w-0 border-b border-[#edf0f3] p-4 last:border-b-0 sm:border-r sm:last:border-r-0 lg:min-h-[96px]">
                    <dt className="text-[10px] font-black uppercase tracking-[0.06em] text-[#8a94a3]">{fact.label}</dt>
                    <dd className="mt-2 break-words text-sm font-extrabold leading-6 text-[#303640]">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {item.facets && item.facets.length > 0 && (
              <div className={`${facts.length > 0 ? 'mt-4' : ''} flex flex-wrap gap-2`}>
                {item.facets.map((facet: any) => (
                  <span key={facet.id} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe4ea] bg-[#fafbfc] px-2.5 py-1.5 text-[10px] font-bold text-[#5f6875]">
                    <Tag className="h-3 w-3 text-[#8a94a3]" aria-hidden="true" />
                    {facet.facet_groups?.name && <span className="text-[#8a94a3]">{facet.facet_groups.name}:</span>}{facet.name}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {contextualRelatedItems.length > 0 && (
          <section className="border-t border-[#d9dde3] pt-9">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="rw-kicker">Connections</p>
                <h2 className="mt-2 text-xl font-black text-[#171a1f]">함께 둘러볼 아이템</h2>
              </div>
              <Network className="h-5 w-5 text-[#8a94a3]" aria-hidden="true" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {contextualRelatedItems.map((related: any) => (
                <Link key={related.id} href={`/items/${related.slug}`} className="group flex min-w-0 items-center gap-3 rounded-[12px] border border-[#dfe3e8] bg-white p-4 transition hover:border-[#b8c6f4] hover:bg-[#f8faff]">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#e0e4e9] bg-[#f2f4f7]">
                    {related.image_url ? (
                      <SafeImage src={related.image_url} alt={related.title} className="h-full w-full object-cover" fallbackSrc="/item-placeholder.svg" />
                    ) : (
                      <Layers className="h-5 w-5 text-[#8a94a3]" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-extrabold text-[#8a94a3]">
                      <span className="text-[#3457c8]">{related.related_reason}</span>
                      <span>·</span>
                      <span>{formatItemMachineLabel(related.item_type)}</span>
                    </div>
                    <h3 className="mt-1 line-clamp-2 text-sm font-extrabold leading-5 text-[#303640] transition group-hover:text-[#2445ad]">{related.title}</h3>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#b1b8c2] transition group-hover:translate-x-0.5 group-hover:text-[#3158e8]" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section id="discussion" className="border-t border-[#d9dde3] pt-9">
          <div className="mb-1 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-[#3158e8]" aria-hidden="true" />
            <p className="rw-kicker">Discussion</p>
          </div>
          <div className="rw-comment-shell">
            <CommentSection targetType="item" targetId={item.id} pathname={`/items/${item.slug}`} />
          </div>
        </section>

        <section className="border-t border-[#d9dde3] pt-7">
          <div className="flex items-start gap-3 text-xs leading-6 text-[#737c89]">
            <Info className="mt-1 h-4 w-4 shrink-0 text-[#3158e8]" aria-hidden="true" />
            <p>이 페이지는 아이템 자체에 등록된 공개 정보와 이 아이템이 포함된 공개 랭킹 관계를 조합해 보여줍니다. 랭킹의 평가 기준과 근거 출처는 각 랭킹 상세에서 확인할 수 있습니다.</p>
          </div>
        </section>
      </div>
    </div>
  )
}
