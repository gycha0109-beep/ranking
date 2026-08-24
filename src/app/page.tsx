import Link from 'next/link'
import { ArrowRight, CalendarDays, Clock3, Flame, Grid3X3, Sparkles } from 'lucide-react'
import SafeImage from '@/components/SafeImage'
import { getHomePresentationData, type HomeFeaturedSlide, type HomeRankingSummary } from '@/lib/queries/home'

export const revalidate = 0

const HOME_CARD_IMAGES = {
  hero: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Front_of_server_racks_at_NERSC.jpg',
    alt: '슈퍼컴퓨터 서버 랙이 늘어선 데이터센터',
    title: 'Wikimedia Commons · CC0',
  },
  airport: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/f/f9/Philadelphia_International_Airport_terminal_from_arriving_airplane.jpg',
    alt: '국제공항 터미널과 계류 중인 항공기',
    title: 'Wikimedia Commons · Public Domain',
  },
  jakarta: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Jakarta_Skyline_from_Semanggi.jpg',
    alt: '자카르타 도심 스카이라인',
    title: 'Wikimedia Commons · CC0',
  },
} as const

function shortDate(value: string | null) {
  if (!value) return '업데이트'
  return new Date(value).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
}

function RankingVisual({
  ranking,
  src,
  alt = '',
  title,
  className = '',
}: {
  ranking: HomeFeaturedSlide
  src?: string
  alt?: string
  title?: string
  className?: string
}) {
  const resolvedSrc = src || ranking.visual_image_url
  if (!resolvedSrc) {
    return <div className={`absolute inset-0 bg-[linear-gradient(135deg,#dfe9ff_0%,#f3f6ff_50%,#eee8ff_100%)] ${className}`} aria-hidden="true" />
  }
  return <SafeImage src={resolvedSrc} alt={alt} title={title} fallbackSrc="/globe.svg" referrerPolicy="no-referrer" className={`absolute inset-0 h-full w-full object-cover ${className}`} />
}

function ScanPanel({ icon, title, tone, rows }: { icon: React.ReactNode; title: string; tone: string; rows: HomeRankingSummary[] }) {
  return (
    <div className="min-w-[280px] flex-1 p-4 sm:p-5">
      <div className={`flex items-center gap-2 text-sm font-black tracking-[-0.025em] ${tone}`}>{icon}<span>{title}</span></div>
      <div className="mt-3 space-y-2.5">
        {rows.slice(0, 3).map((ranking, index) => (
          <Link key={ranking.id} href={`/rankings/${ranking.slug}`} className="group flex min-w-0 items-center gap-2.5">
            <span className="w-4 shrink-0 text-right text-[11px] font-black tabular-nums text-[#9aa2ad]">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] font-black text-[#303743] group-hover:text-[#2563eb]">{ranking.title}</span>
            <span className="shrink-0 text-[9px] font-bold text-[#a0a7b0]">{ranking.categories?.name || '랭킹'}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function TodayPick({ ranking }: { ranking: HomeFeaturedSlide }) {
  const [first, second, third] = ranking.entries
  return (
    <Link href={`/rankings/${ranking.slug}`} className="group relative block min-h-[340px] overflow-hidden rounded-[22px] border border-[#e0e4ec] bg-[#eef3ff] shadow-[0_16px_40px_rgba(36,56,96,0.09)] sm:min-h-[370px]">
      <RankingVisual
        ranking={ranking}
        src={HOME_CARD_IMAGES.hero.src}
        alt={HOME_CARD_IMAGES.hero.alt}
        title={HOME_CARD_IMAGES.hero.title}
        className="object-center transition duration-500 group-hover:scale-[1.02]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.99)_0%,rgba(255,255,255,0.96)_40%,rgba(255,255,255,0.72)_57%,rgba(255,255,255,0.05)_82%)]" />
      <div className="relative z-10 flex min-h-[340px] max-w-[760px] flex-col p-5 sm:min-h-[370px] sm:p-8">
        <div className="flex items-center gap-2"><span className="rounded-full bg-[#6d4aff] px-3 py-1.5 text-[10px] font-black text-white">TODAY&apos;S PICK</span><span className="text-[10px] font-black text-[#7f8793]">{ranking.categories?.name || '랭킹'}</span></div>
        <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-5 sm:mt-8">
          <span className="rw-rank-number text-[5.4rem] font-black leading-[0.8] tracking-[-0.08em] text-[#6d4aff] sm:text-[6.5rem]">01</span>
          <div className="min-w-0 pt-1"><p className="text-[11px] font-black text-[#7f8793]">오늘 먼저 볼 1위</p><h2 className="mt-2 line-clamp-2 text-[1.65rem] font-black leading-[1.12] tracking-[-0.045em] text-[#171a1f] sm:text-[2.15rem]">{ranking.title}</h2><p className="mt-4 truncate text-[1.4rem] font-black tracking-[-0.04em] text-[#111827] sm:mt-5 sm:text-[1.55rem]">{first?.item.title || '1위 확인하기'}</p></div>
        </div>
        <div className="mt-auto grid max-w-[560px] gap-2 pt-6 sm:grid-cols-2">
          {[second, third].filter(Boolean).map((entry) => <div key={entry!.position} className="flex items-center gap-3 rounded-[12px] border border-white/90 bg-white/90 px-3.5 py-3 shadow-sm"><span className="rw-rank-number text-2xl font-black text-[#2563eb]">{String(entry!.position).padStart(2, '0')}</span><span className="truncate text-xs font-black text-[#303743]">{entry!.item.title}</span></div>)}
        </div>
      </div>
      <span className="absolute bottom-6 right-6 z-20 hidden items-center gap-1 rounded-full bg-white/94 px-3.5 py-2 text-[10px] font-black text-[#303743] shadow-sm sm:inline-flex">전체 랭킹 보기 <ArrowRight className="h-3.5 w-3.5" /></span>
    </Link>
  )
}

function TopThree({ ranking }: { ranking: HomeFeaturedSlide }) {
  return (
    <Link href={`/rankings/${ranking.slug}`} className="group overflow-hidden rounded-[18px] border border-[#e3e6ec] bg-white shadow-[0_10px_30px_rgba(29,46,78,0.05)]">
      <div className="flex items-center justify-between border-b border-[#edf0f4] px-5 py-4"><div className="min-w-0"><p className="text-[10px] font-black text-[#8a929d]">TOP 3 한눈에</p><h3 className="mt-1 truncate text-sm font-black text-[#252a32]">{ranking.title}</h3></div><ArrowRight className="h-4 w-4 text-[#a2a9b2]" /></div>
      <div className="grid min-h-[250px] grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4 p-5">{ranking.entries.slice(0, 3).map((entry) => <div key={entry.position} className="flex min-w-0 items-center gap-3"><span className={`rw-rank-number w-8 text-2xl font-black ${entry.position === 1 ? 'text-[#6d4aff]' : 'text-[#8e98a6]'}`}>{String(entry.position).padStart(2, '0')}</span><p className="truncate text-sm font-black text-[#262c35]">{entry.item.title}</p></div>)}</div>
        <div className="relative overflow-hidden bg-[#eef2f8]">
          <RankingVisual
            ranking={ranking}
            src={HOME_CARD_IMAGES.airport.src}
            alt={HOME_CARD_IMAGES.airport.alt}
            title={HOME_CARD_IMAGES.airport.title}
            className="object-center transition duration-500 group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.08)_45%,rgba(255,255,255,0)_100%)]" />
        </div>
      </div>
    </Link>
  )
}

function AnotherNumberOne({ ranking }: { ranking: HomeFeaturedSlide }) {
  const first = ranking.entries[0]
  return (
    <Link href={`/rankings/${ranking.slug}`} className="group relative min-h-[300px] overflow-hidden rounded-[18px] border border-[#e9e0fb] bg-[#fbf8ff] p-6 shadow-[0_10px_30px_rgba(91,61,150,0.05)]">
      <RankingVisual
        ranking={ranking}
        src={HOME_CARD_IMAGES.jakarta.src}
        alt={HOME_CARD_IMAGES.jakarta.alt}
        title={HOME_CARD_IMAGES.jakarta.title}
        className="object-center transition duration-500 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(251,248,255,0.99)_0%,rgba(251,248,255,0.94)_48%,rgba(251,248,255,0.36)_72%,rgba(251,248,255,0.04)_100%)]" />
      <div className="relative z-10 flex h-full max-w-[62%] flex-col"><span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#f0e8ff] px-3 py-1.5 text-[10px] font-black text-[#7c3aed]"><Sparkles className="h-3.5 w-3.5" /> 또 다른 1위</span><p className="mt-5 text-[11px] font-black text-[#9a90a8]">{ranking.categories?.name || '랭킹'} · {ranking.title}</p><div className="mt-4 flex items-end gap-3"><span className="rw-rank-number text-[4.5rem] font-black leading-none text-[#8b5cf6]">01</span><p className="min-w-0 pb-1 text-[1.45rem] font-black leading-tight tracking-[-0.04em] text-[#211a2d]">{first?.item.title || '1위 확인하기'}</p></div><p className="mt-auto pt-5 text-xs font-bold leading-5 text-[#8b8492]">전체 순위와 선정 근거를 바로 확인해보세요.</p></div>
    </Link>
  )
}

export default async function HomePage() {
  const { featuredSlides, recentRankings, categories } = await getHomePresentationData()
  const populated = categories.filter((category) => category.ranking_count > 0)
  const visibleCategories = (populated.length ? populated : categories).slice(0, 9)
  const categoryLeaders = [...populated].sort((a, b) => b.ranking_count - a.ranking_count).slice(0, 3)
  const hero = featuredSlides[0]
  const topThree = featuredSlides[1]
  const another = featuredSlides[2] || featuredSlides[1]

  return (
    <div className="rw-page bg-[#fbfcfe] pb-16 sm:pb-20">
      <section className="rw-container pt-5 sm:pt-7">
        {hero ? <TodayPick ranking={hero} /> : <div className="rounded-[18px] border border-[#e2e5ea] bg-white px-6 py-16 text-center text-sm font-bold text-[#6b7280]">공개 랭킹을 준비 중입니다.</div>}
      </section>

      <section className="rw-container mt-3">
        <div className="rw-scroll-row flex overflow-x-auto rounded-[18px] border border-[#e3e6ec] bg-white shadow-[0_8px_24px_rgba(29,46,78,0.035)] [&>*+*]:border-l [&>*+*]:border-[#edf0f4]">
          <ScanPanel icon={<Flame className="h-4 w-4" />} title="지금 볼 랭킹" tone="text-[#ef4444]" rows={featuredSlides.slice(0, 3)} />
          <ScanPanel icon={<Sparkles className="h-4 w-4" />} title="새로 업데이트" tone="text-[#6d4aff]" rows={recentRankings.slice(0, 3)} />
          <div className="min-w-[280px] flex-1 p-4 sm:p-5"><div className="flex items-center gap-2 text-sm font-black text-[#0f9f6e]"><Grid3X3 className="h-4 w-4" />카테고리별 랭킹</div><div className="mt-3 space-y-2.5">{categoryLeaders.map((category, index) => <Link key={category.id} href={`/categories/${category.slug}`} className="group flex items-center gap-2.5"><span className="w-4 text-right text-[11px] font-black text-[#9aa2ad]">{index + 1}</span><span className="min-w-0 flex-1 truncate text-[12px] font-black text-[#303743] group-hover:text-[#2563eb]">{category.name}</span><span className="text-[9px] font-black tabular-nums text-[#0f9f6e]">{category.ranking_count}개</span></Link>)}</div></div>
        </div>
      </section>

      {(topThree || another) ? <section className="rw-container mt-3"><div className="grid gap-3 xl:grid-cols-2">{topThree ? <TopThree ranking={topThree} /> : null}{another ? <AnotherNumberOne ranking={another} /> : null}</div></section> : null}

      <section className="rw-container mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-[18px] border border-[#e3e6ec] bg-white shadow-[0_10px_30px_rgba(29,46,78,0.04)]"><div className="flex items-center justify-between border-b border-[#edf0f4] px-5 py-4"><div><p className="text-[10px] font-black text-[#8a929d]">SCAN & OPEN</p><h2 className="mt-1 text-lg font-black tracking-[-0.035em] text-[#171a1f]">지금 볼 랭킹</h2></div><Link href="/search?type=ranking" className="text-[10px] font-black text-[#737d8a]">전체 보기 →</Link></div><div className="divide-y divide-[#edf0f4]">{recentRankings.slice(0, 8).map((ranking, index) => <Link key={ranking.id} href={`/rankings/${ranking.slug}`} className="group grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 hover:bg-[#f8faff]"><span className={`rw-rank-number text-lg font-black ${index < 3 ? 'text-[#6d4aff]' : 'text-[#9aa2ad]'}`}>{String(index + 1).padStart(2, '0')}</span><div className="min-w-0"><p className="truncate text-[13px] font-black text-[#2a3038] group-hover:text-[#2563eb]">{ranking.title}</p><p className="mt-1 truncate text-[9px] font-bold text-[#a0a7b0]">{ranking.categories?.name || '랭킹'}{ranking.subcategories?.name ? ` · ${ranking.subcategories.name}` : ''}</p></div><span className="text-[9px] font-bold text-[#9aa2ad]">{shortDate(ranking.published_at || ranking.updated_at)}</span></Link>)}</div></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1"><div className="rounded-[18px] border border-[#e3e6ec] bg-white p-5 shadow-[0_10px_30px_rgba(29,46,78,0.04)]"><h2 className="text-lg font-black tracking-[-0.035em] text-[#171a1f]">카테고리 핫 랭킹</h2><div className="mt-4 grid grid-cols-3 gap-2">{visibleCategories.map((category) => <Link key={category.id} href={`/categories/${category.slug}`} className="rounded-[12px] border border-[#e6e9ee] bg-[#fbfcfe] px-3 py-3 text-center hover:border-[#bdc9e7]"><span className="block truncate text-[11px] font-black text-[#343b46]">{category.name}</span><span className="mt-1 block text-[9px] font-bold text-[#9aa2ad]">랭킹 {category.ranking_count}</span></Link>)}</div></div><div className="rounded-[18px] border border-[#e3e6ec] bg-white p-5 shadow-[0_10px_30px_rgba(29,46,78,0.04)]"><div className="flex items-center justify-between"><h2 className="text-lg font-black tracking-[-0.035em] text-[#171a1f]">방금 업데이트된 랭킹</h2><Clock3 className="h-5 w-5 text-[#7c3aed]" /></div><div className="mt-3 divide-y divide-[#edf0f4]">{recentRankings.slice(0, 4).map((ranking) => <Link key={ranking.id} href={`/rankings/${ranking.slug}`} className="group flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-[12px] font-black text-[#343b46] group-hover:text-[#2563eb]">{ranking.title}</p><p className="mt-1 text-[9px] font-bold text-[#9aa2ad]">{ranking.categories?.name || '랭킹'}</p></div><span className="flex shrink-0 items-center gap-1 text-[9px] font-bold text-[#9aa2ad]"><CalendarDays className="h-3 w-3" />{shortDate(ranking.published_at || ranking.updated_at)}</span></Link>)}</div></div></div>
      </section>
    </div>
  )
}
