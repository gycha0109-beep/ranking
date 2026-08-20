import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import './globals.css'
import Navbar from '@/components/Navbar'
import LikeDock from '@/components/engagement/LikeDock'
import ProductTelemetry from '@/components/telemetry/ProductTelemetry'
import { getSiteOrigin, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo'

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: {
    default: `${SITE_NAME} - 신뢰받는 랭킹 아카이브`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: SITE_NAME,
    title: `${SITE_NAME} - 신뢰받는 랭킹 아카이브`,
    description: SITE_DESCRIPTION,
    url: '/',
  },
  twitter: {
    card: 'summary',
    title: `${SITE_NAME} - 신뢰받는 랭킹 아카이브`,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Navbar />
        <main className="flex-grow flex flex-col relative">{children}</main>
        <LikeDock />
        <Suspense fallback={null}><ProductTelemetry /></Suspense>
        <footer className="relative z-10 border-t border-[#2c3138] bg-[#15191f] text-white">
          <div className="rw-container grid gap-8 py-9 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center bg-white text-[9px] font-black tracking-[-0.04em] text-[#15191f]">RW</span>
                <div>
                  <p className="text-sm font-black tracking-[-0.02em]">랭킹위키</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#8f98a5]">Evidence ranking archive</p>
                </div>
              </div>
              <p className="mt-4 max-w-lg text-xs leading-6 text-[#aeb5bf]">
                후보 범위, 평가 기준, 선정 이유와 변경 이력을 공개해 순위가 만들어진 근거를 보존합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-[#d2d6dc] sm:justify-end">
              <Link href="/categories" className="hover:text-white">카테고리</Link>
              <Link href="/search" className="hover:text-white">검색</Link>
              <span className="text-[#757e8a]">© {new Date().getFullYear()} Ranking Wiki</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
