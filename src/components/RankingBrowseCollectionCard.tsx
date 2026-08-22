import Link from 'next/link'
import { CalendarDays, ChevronRight, Eye, Heart } from 'lucide-react'
import SafeImage from '@/components/SafeImage'

type RankingBrowseCollectionCardProps = {
  ranking: {
    id: string
    slug: string
    title: string
    summary: string
    cover_image_url: string | null
    published_at: string | null
    sort_time: string
    unique_view_count: number
    like_count: number
    subcategories?: { name: string; slug: string } | null
  }
  categoryName: string
  subcategoryName?: string | null
}

export default function RankingBrowseCollectionCard({
  ranking,
  categoryName,
  subcategoryName,
}: RankingBrowseCollectionCardProps) {
  const initials = ranking.title.trim().slice(0, 2) || 'RW'
  const resolvedSubcategory = subcategoryName || ranking.subcategories?.name || null

  return (
    <Link
      href={`/rankings/${ranking.slug}`}
      className="group grid overflow-hidden rounded-[16px] border border-[#dfe3e8] bg-white transition hover:-translate-y-0.5 hover:border-[#bcc9e4] hover:shadow-[0_16px_38px_rgba(17,24,39,0.08)] sm:grid-cols-[190px_minmax(0,1fr)]"
    >
      <div className="relative min-h-[170px] overflow-hidden bg-[#151a22] sm:min-h-full">
        {ranking.cover_image_url ? (
          <SafeImage
            src={ranking.cover_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
            fallbackSrc="/item-placeholder.svg"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(70,109,231,0.9),transparent_34%),linear-gradient(135deg,#151a22_0%,#273449_58%,#1d4ed8_100%)]">
            <span className="absolute bottom-4 right-4 text-[4.5rem] font-black leading-none tracking-[-0.08em] text-white/10">{initials}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <span className="absolute bottom-4 left-4 rounded-full bg-white/92 px-2.5 py-1 text-[9px] font-black text-[#1f2937]">RANKING</span>
      </div>

      <div className="flex min-w-0 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#8a94a3]">
          <span className="text-[#2563eb]">{categoryName}</span>
          {resolvedSubcategory && <><span>·</span><span>{resolvedSubcategory}</span></>}
        </div>

        <h3 className="mt-2 text-lg font-black leading-6 tracking-[-0.03em] text-[#1c2026] transition group-hover:text-[#1d4ed8] sm:text-xl">{ranking.title}</h3>
        <p className="mt-2 line-clamp-2 text-xs font-medium leading-6 text-[#69717c]">{ranking.summary}</p>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-[#8a94a3]">
            <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" aria-hidden="true" />조회 {ranking.unique_view_count.toLocaleString('ko-KR')}</span>
            <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" aria-hidden="true" />좋아요 {ranking.like_count.toLocaleString('ko-KR')}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{new Date(ranking.published_at || ranking.sort_time).toLocaleDateString('ko-KR')}</span>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#a9b1bc] transition group-hover:translate-x-0.5 group-hover:text-[#2563eb]" aria-hidden="true" />
        </div>
      </div>
    </Link>
  )
}
