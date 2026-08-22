import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import './globals.css'
import Navbar from '@/components/Navbar'
import LikeDock from '@/components/engagement/LikeDock'
import ProductTelemetry from '@/components/telemetry/ProductTelemetry'
import { getSiteOrigin, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo'

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim()
const bingSiteVerification = process.env.BING_SITE_VERIFICATION?.trim()

const searchEngineVerification: Metadata['verification'] =
  googleSiteVerification || bingSiteVerification
    ? {
        ...(googleSiteVerification ? { google: googleSiteVerification } : {}),
        ...(bingSiteVerification
          ? { other: { 'msvalidate.01': bingSiteVerification } }
          : {}),
      }
    : undefined

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
  verification: searchEngineVerification,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Navbar />
        <main className="flex-grow flex flex-col relative">{children}</main>
        <LikeDock />
        <Suspense fallback={null}><ProductTelemetry /></Suspense>
        <footer className="relative z-10 border-t border-[#e7e9ed] bg-white text-[#4b5563]">
          <div className="rw-container flex flex-col gap-4 py-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black tracking-[-0.04em] text-[#171a1f]">RANKINGWIKI</p>
              <p className="mt-1 max-w-xl text-[11px] leading-5 text-[#8a929d]">
                공개된 근거와 변경 이력을 바탕으로 다양한 순위를 한곳에서 살펴봅니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-bold text-[#6b7280]">
              <Link href="/search" className="hover:text-[#2563eb]">탐색</Link>
              <Link href="/categories" className="hover:text-[#2563eb]">카테고리</Link>
              <span className="text-[#9aa1aa]">© {new Date().getFullYear()} Ranking Wiki</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
