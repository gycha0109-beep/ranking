import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getItemBySlug, getRankingsContainingItem, getRelatedItems } from '@/lib/queries/public'
import { getItemSponsorshipDisclosures } from '@/lib/queries/sponsorships'
import { Award, ChevronRight, ExternalLink, Layers, Network, ShieldAlert, Tag } from 'lucide-react'
import SafeImage from '@/components/SafeImage'
import SponsorshipDisclosure from '@/components/sponsorship/SponsorshipDisclosure'

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

  return (
    <div className="rw-page pb-20">
      <header className="border-b border-[#e3e7ec] bg-white">
        <div className="rw-reading grid gap-7 py-9 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start sm:py-11">
          <div className="flex h-44 w-44 items-center justify-center overflow-hidden rounded-[22px] border border-[#e1e6ec] bg-[#f3f5f7] sm:h-[180px] sm:w-[180px]">
            {item.image_url ? (
              <SafeImage src={item.image_url} alt={item.title} className="h-full w-full object-cover" fallbackSrc="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-[#9aa3af]"><Layers className="h-8 w-8" /><span className="text-xs">이미지 없음</span></div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap gap-2 text-[10px] font-extrabold">
              <span className="rounded-lg bg-[#eef2ff] px-2.5 py-1.5 text-[#3457c8]">{item.item_type}</span>
              {item.brand_or_creator && <span className="rounded-lg bg-[#f0f2f5] px-2.5 py-1.5 text-[#667085]">{item.brand_or_creator}</span>}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#171a1f] sm:text-4xl">{item.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#5f6875]">{item.description || '이 아이템에 대한 상세 설명이 등록되어 있지 않습니다.'}</p>
            {sponsorshipDisclosures.length > 0 && <div className="mt-5"><SponsorshipDisclosure disclosures={sponsorshipDisclosures} /></div>}

            {item.facets && item.facets.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {item.facets.map((facet: any) => (
                  <span key={facet.id} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe4ea] bg-[#fafbfc] px-2.5 py-1.5 text-[10px] font-bold text-[#6b7280]">
                    <Tag className="h-3 w-3 text-[#8a94a3]" />
                    {facet.facet_groups?.name && <span className="text-[#9aa3af]">{facet.facet_groups.name}:</span>}{facet.name}
                  </span>
                ))}
              </div>
            )}

            {(item.external_url || item.affiliate_url) && (
              <div className="mt-6 flex flex-wrap gap-2">
                {item.external_url && <a href={item.external_url} target="_blank" rel="noopener noreferrer" className="rw-button-secondary px-4 text-xs"><ExternalLink className="h-3.5 w-3.5" />공식 사이트</a>}
                {item.affiliate_url && <a href={item.affiliate_url} target="_blank" rel="noopener noreferrer" className="rw-button-primary px-4 text-xs"><ExternalLink className="h-3.5 w-3.5" />구매 정보</a>}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="rw-reading space-y-12 pt-8 sm:pt-10">
        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div><p className="rw-kicker">Ranking footprint</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#171a1f]">이 아이템이 등장하는 랭킹</h2></div>
            <span className="text-xs font-semibold text-[#8a94a3]">{rankings.length}건</span>
          </div>

          {rankings.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-[#dde2e8] bg-white">
              {rankings.map((ranking: any, index: number) => (
                <Link key={ranking.id} href={`/rankings/${ranking.slug}`} className={`group grid gap-4 p-5 transition hover:bg-[#f8f9fb] sm:grid-cols-[56px_1fr_auto] sm:items-center ${index > 0 ? 'border-t border-[#edf0f3]' : ''}`}>
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-[#171a1f] text-white">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-white/60">Rank</span>
                    <span className="text-base font-black leading-none">{ranking.position}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#8a94a3]"><span className="text-[#3457c8]">{ranking.categories?.name}</span>{ranking.subcategories?.name && <><span>·</span><span>{ranking.subcategories.name}</span></>}</div>
                    <h3 className="mt-1 truncate text-base font-extrabold text-[#303640] transition group-hover:text-[#2445ad]">{ranking.title}</h3>
                    {ranking.summary && <p className="mt-1 line-clamp-1 text-xs text-[#7b8491]">{ranking.summary}</p>}
                  </div>
                  <ChevronRight className="hidden h-4 w-4 text-[#b1b8c2] transition group-hover:translate-x-0.5 group-hover:text-[#3457c8] sm:block" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="rw-surface rw-card flex flex-col items-center justify-center px-6 py-14 text-center">
              <ShieldAlert className="h-7 w-7 text-[#a4acb7]" />
              <h3 className="mt-4 text-sm font-extrabold text-[#3f4752]">아직 공개 랭킹에 등재되지 않았습니다</h3>
              <p className="mt-2 text-xs text-[#8a94a3]">이 아이템이 포함된 랭킹이 발행되면 이곳에 표시됩니다.</p>
            </div>
          )}
        </section>

        {relatedItems.length > 0 && (
          <section className="border-t border-[#dde2e8] pt-10">
            <div className="mb-5 flex items-center justify-between gap-4"><div><p className="rw-kicker">Connections</p><h2 className="mt-2 text-xl font-black text-[#171a1f]">관련 아이템</h2></div><Network className="h-5 w-5 text-[#8a94a3]" /></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {relatedItems.map((related: any) => (
                <Link key={related.id} href={`/items/${related.slug}`} className="rw-surface rw-card rw-card-interactive group overflow-hidden">
                  <div className="aspect-[16/10] overflow-hidden bg-[#f0f2f5]">
                    {related.image_url ? <SafeImage src={related.image_url} alt={related.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" fallbackSrc="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400" /> : <div className="flex h-full items-center justify-center"><Layers className="h-7 w-7 text-[#a4acb7]" /></div>}
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[9px] font-extrabold text-[#8a94a3]"><span className="text-[#3457c8]">{related.related_reason}</span><span>·</span><span>{related.item_type}</span></div>
                    <h3 className="mt-2 line-clamp-2 text-sm font-extrabold leading-6 text-[#303640] transition group-hover:text-[#2445ad]">{related.title}</h3>
                    {related.brand_or_creator && <p className="mt-1 text-xs text-[#8a94a3]">{related.brand_or_creator}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
