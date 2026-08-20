'use client'

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { HomeFeaturedEntry, HomeFeaturedSlide } from '@/lib/queries/home'

const AUTOPLAY_MS = 6200
const MANUAL_HOLD_MS = 9000

function formatDate(value: string | null) {
  if (!value) return '기준일 확인'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(value))
}

function SlideImage({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!src || failed) return null

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className="absolute inset-0 h-full w-full object-cover opacity-[0.15] mix-blend-luminosity"
      onError={() => setFailed(true)}
    />
  )
}

function PodiumEntry({
  entry,
  position,
  primary = false,
  className = '',
}: {
  entry?: HomeFeaturedEntry
  position: 1 | 2 | 3
  primary?: boolean
  className?: string
}) {
  const content = (
    <>
      <span
        className={`rw-rank-number block font-black leading-none tracking-[-0.07em] ${
          primary ? 'text-[4.65rem] sm:text-[5.4rem]' : 'text-[2.5rem] sm:text-[3.1rem]'
        }`}
      >
        {String(position).padStart(2, '0')}
      </span>
      <span className={`mt-4 block font-black leading-tight tracking-[-0.035em] ${primary ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'}`}>
        {entry?.item.title || '순위 데이터 확인'}
      </span>
      {entry && (entry.item.brand_or_creator || entry.reason) ? (
        <span className="mt-2 block line-clamp-1 text-[10px] font-bold text-current/65 sm:text-[11px]">
          {entry.item.brand_or_creator || entry.reason}
        </span>
      ) : null}
    </>
  )

  const baseClass = `${className} group relative flex min-w-0 flex-col justify-end overflow-hidden border transition ${
    primary
      ? 'min-h-[205px] border-white/45 bg-white px-5 py-6 text-[#123caa] shadow-[0_18px_48px_rgba(0,0,0,0.18)] sm:min-h-[250px] sm:px-6'
      : 'min-h-[150px] border-white/30 bg-white/92 px-4 py-5 text-[#18305f] sm:min-h-[190px] sm:px-5'
  }`

  if (!entry) {
    return <div className={baseClass}>{content}</div>
  }

  return (
    <Link
      href={`/items/${entry.item.slug}`}
      className={`${baseClass} hover:-translate-y-1 hover:border-white focus-visible:-translate-y-1`}
      aria-label={`${position}위 ${entry.item.title} 상세 보기`}
    >
      {content}
    </Link>
  )
}

export default function FeaturedRankingSlider({ slides }: { slides: HomeFeaturedSlide[] }) {
  const [index, setIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const [manualHold, setManualHold] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const manualTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    return () => {
      if (manualTimerRef.current) clearTimeout(manualTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (slides.length <= 1 || hovered || focusWithin || manualHold || reducedMotion) return

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length)
    }, AUTOPLAY_MS)

    return () => window.clearInterval(timer)
  }, [focusWithin, hovered, manualHold, reducedMotion, slides.length])

  const moveTo = (nextIndex: number) => {
    if (slides.length === 0) return
    setIndex((nextIndex + slides.length) % slides.length)
    setManualHold(true)
    if (manualTimerRef.current) clearTimeout(manualTimerRef.current)
    manualTimerRef.current = setTimeout(() => setManualHold(false), MANUAL_HOLD_MS)
  }

  if (slides.length === 0) {
    return (
      <div className="rw-media-hero flex min-h-[390px] items-center justify-center border border-[#1746bd] px-7 text-center text-white sm:min-h-[470px]">
        <div className="relative z-10">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/65">Featured ranking</p>
          <p className="mt-4 text-xl font-black tracking-[-0.035em]">공개 랭킹을 준비 중입니다.</p>
        </div>
      </div>
    )
  }

  const slide = slides[index]
  const entries = new Map(slide.entries.map((entry) => [entry.position, entry]))

  return (
    <section
      className="rw-media-hero relative min-h-[390px] border border-[#1746bd] text-white shadow-[0_22px_55px_rgba(28,55,132,0.2)] sm:min-h-[470px]"
      role="region"
      aria-roledescription="carousel"
      aria-label="주목할 랭킹"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setFocusWithin(false)
        }
      }}
    >
      <SlideImage key={slide.id} src={slide.visual_image_url} />

      <div key={`content-${slide.id}`} className="rw-featured-slide relative z-10 flex min-h-[390px] flex-col p-5 sm:min-h-[470px] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/65">Featured ranking</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-extrabold text-white/75">
              {slide.categories?.name ? <span>{slide.categories.name}</span> : null}
              {slide.subcategories?.name ? (
                <>
                  <span className="text-white/35">·</span>
                  <span>{slide.subcategories.name}</span>
                </>
              ) : null}
            </div>
          </div>
          <time className="text-[10px] font-bold tabular-nums text-white/60">
            {formatDate(slide.published_at || slide.updated_at)}
          </time>
        </div>

        <h2 className="mt-4 max-w-3xl text-[1.65rem] font-black leading-[1.08] tracking-[-0.045em] sm:text-[2.05rem]">
          {slide.title}
        </h2>

        <div className="mt-6 grid flex-1 gap-2.5 lg:grid-cols-[0.94fr_1.12fr_0.94fr] lg:items-end">
          <PodiumEntry
            entry={entries.get(1)}
            position={1}
            primary
            className="lg:col-start-2 lg:row-start-1"
          />
          <PodiumEntry
            entry={entries.get(2)}
            position={2}
            className="lg:col-start-1 lg:row-start-1"
          />
          <PodiumEntry
            entry={entries.get(3)}
            position={3}
            className="lg:col-start-3 lg:row-start-1"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/18 pt-4">
          <Link
            href={`/rankings/${slide.slug}`}
            className="group inline-flex min-h-10 items-center gap-2 border border-white/45 bg-white/8 px-4 text-xs font-black text-white transition hover:bg-white hover:text-[#1746bd]"
          >
            전체 순위 보기
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </Link>

          <div className="flex items-center gap-2">
            <span className="mr-1 text-[10px] font-black tabular-nums text-white/65" aria-live="polite">
              {String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={() => moveTo(index - 1)}
              className="inline-flex h-9 w-9 items-center justify-center border border-white/35 text-white transition hover:bg-white hover:text-[#1746bd]"
              aria-label="이전 주목할 랭킹"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => moveTo(index + 1)}
              className="inline-flex h-9 w-9 items-center justify-center border border-white/35 text-white transition hover:bg-white hover:text-[#1746bd]"
              aria-label="다음 주목할 랭킹"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {slides.length > 1 ? (
          <div className="mt-4 flex items-center gap-1.5" aria-label="주목할 랭킹 슬라이드 선택">
            {slides.map((candidate, candidateIndex) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => moveTo(candidateIndex)}
                className={`h-1.5 transition-all ${candidateIndex === index ? 'w-8 bg-white' : 'w-4 bg-white/32 hover:bg-white/60'}`}
                aria-label={`${candidateIndex + 1}번 슬라이드: ${candidate.title}`}
                aria-current={candidateIndex === index ? 'true' : undefined}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
