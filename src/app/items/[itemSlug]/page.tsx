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

  return (
    <div className="rw-page pb-16 sm:pb-20">
      <header className="border-b border-[#dfe3e8] bg-white">
        <div className="rw-container max-w-[1120px] py-8 sm:py-10 lg:py-12">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8a94a3]">
            <Link href="/" className="hover:text-[#2445ad]">홈</Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span>아이템</span>
          </div>

          <div className="mt-6 grid gap-7 md:grid-cols-[190px_minmax(0,1fr)] md:items-start lg:gap-9">
            <div className="flex h-[190px] w-full max-w-[190px] items-center justify-center overflow-hidden rounded-[22px] border border-[#dfe4ea] bg-[#f3f5f7]">
              {item.image_url ? (
                <SafeImage
                  src={item.image_url}
                  alt={item.title}
                  className="h-full w-full object-cover"
                  fallbackSrc="/item-placeholder.svg"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#f1f4f8] text-[#6f7885]">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d8dee6] bg-white text-xl font-black text-[#3158e8]">{initials}</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em]">Ranking item</span>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold">
                <span className="rounded-lg bg-[#eef2ff] px-2.5 py-1.5 text-[#3457c8]">{itemTypeLabel}</span>
                {item.brand_or_creator && (
                  <span className="rounded-lg bg-[#f0f2f5] px-2.5 py-1.5 text-[#667085]">{item.brand_or_creator}</span>
                )}
              </div>

              <h1 className="rw-display mt-4 text-[34px] font-black leading-[1.08] tracking-[-0.045em] text-[#11151b] sm:text-[44px]">{item.title}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#5f6875] sm:text-[15px]">
                {item.description || '이 아이템에 대한 상세 설명이 아직 등록되어 있지 않습니다.'}
              </p>

              {sponsorshipDisclosures.length > 0 && (
                <div className="mt-5"><SponsorshipDisclosure disclosures={sponsorshipDisclosures} /></div>
              )}

              {(item.external_url || item.affiliate_url) && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {item.external_url && (
                    <a href={item.external_url} target="_blank" rel="noopener noreferrer" className="rw-button-secondary px-4 text-xs">
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />공식 사이트
                    </a>
                  )}
                  {item.affiliate_url && (
                    <a href={item.affiliate_url} target="_blank" rel="noopener noreferrer" className="rw-button-primary px-4 text-xs">
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />구매 정보
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="rw-container max-w-[1120px] space-y-10 pt-8 sm:space-y-12 sm:pt-10">
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="rw-kicker">Ranking footprint</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#171a1f]">이 아이템이 등장하는 랭킹</h2>
            </div>
            <span className="text-xs font-semibold text-[#8a94a3]">{rankings.length}건</span>
          </div>

          {rankings.length > 0 ? (
            <ol className="overflow-hidden border-y border-[#cfd5dd] bg-white">
              {rankings.map((ranking: any) => (
                <li key={ranking.id} className="border-b border-[#e6e9ed] last:border-b-0">
                  <Link
                    href={`/rankings/${ranking.slug}`}
                    className="group grid gap-3 px-4 py-4 transition hover:bg-[#f8faff] sm:grid-cols-[62px_minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-5"
                  >
                    <div className="rw-rank-number flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-[#171a1f] text-white">
                      <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-white/60">Rank</span>
                      <strong className="text-lg font-black leading-none">{ranking.position}</strong>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#8a94a3]">
                        {ranking.categories?.name && <span className="text-[#3457c8]">{ranking.categories.name}</span>}
                        {ranking.subcategories?.name && <><span>·</span><span>{ranking.subcategories.name}</span></>}
                      </div>
                      <h3 className="mt-1 line-clamp-1 text-sm font-black text-[#303640] transition group-hover:text-[#2445ad] sm:text-[15px]">{ranking.title}</h3>
                      {ranking.summary && <p className="mt-1 line-clamp-1 text-xs text-[#737c89]">{ranking.summary}</p>}
                    </div>
                    <ChevronRight className="hidden h-4 w-4 text-[#aab2bd] transition group-hover:translate-x-0.5 group-hover:text-[#3158e8] sm:block" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className="border border-[#dfe3e8] bg-white px-6 py-12 text-center">
              <ShieldAlert className="mx-auto h-7 w-7 text-[#8a94a3]" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-extrabold text-[#3f4752]">아직 공개 랭킹에 등재되지 않았습니다</h3>
              <p className="mt-2 text-xs text-[#737c89]">이 아이템이 포함된 랭킹이 발행되면 이곳에 표시됩니다.</p>
            </div>
          )}
        </section>

        {hasStructuredInfo && (
          <section className="border-t border-[#d9dde3] pt-9">
            <div className="mb-5">
              <p className="rw-kicker">Item facts</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#171a1f]">핵심 정보</h2>
              <p className="mt-2 max-w-2xl text-xs leading-6 text-[#737c89]">등록된 공개 metadata와 분류 태그만 표시합니다. 도메인별 고정 필드를 별도로 만들지 않습니다.</p>
            </div>

            {facts.length > 0 && (
              <dl className="grid overflow-hidden border border-[#dfe3e8] bg-white sm:grid-cols-2 lg:grid-cols-4">
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

        <section id="discussion" className="border-t border-[#d9dde3] pt-9">
          <div className="mb-1 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-[#3158e8]" aria-hidden="true" />
            <p className="rw-kicker">Discussion</p>
          </div>
          <div className="rw-comment-shell">
            <CommentSection targetType="item" targetId={item.id} pathname={`/items/${item.slug}`} />
          </div>
        </section>

        {relatedItems.length > 0 && (
          <section className="border-t border-[#d9dde3] pt-9">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="rw-kicker">Connections</p>
                <h2 className="mt-2 text-xl font-black text-[#171a1f]">관련 아이템</h2>
              </div>
              <Network className="h-5 w-5 text-[#8a94a3]" aria-hidden="true" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {relatedItems.map((related: any) => (
                <Link key={related.id} href={`/items/${related.slug}`} className="group flex min-w-0 items-center gap-3 border border-[#dfe3e8] bg-white p-4 transition hover:border-[#b8c6f4] hover:bg-[#f8faff]">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e0e4e9] bg-[#f2f4f7]">
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
