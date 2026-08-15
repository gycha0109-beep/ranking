import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import LikeDock from '@/components/engagement/LikeDock'
import { ShieldCheck } from 'lucide-react'
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
        <footer className="relative z-10 border-t border-[#dde2e8] bg-white py-8 text-xs text-[#6b7280]">
          <div className="rw-container flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-[#3f4752]">
              <ShieldCheck className="h-4 w-4 text-[#3457c8]" />
              <span className="font-extrabold text-[#171a1f]">랭킹위키</span>
              <span className="hidden sm:inline">기준과 변경 이력을 공개하는 랭킹 아카이브</span>
            </div>
            <p className="leading-relaxed">&copy; {new Date().getFullYear()} Ranking Wiki</p>
          </div>
        </footer>
      </body>
    </html>
  )
}
