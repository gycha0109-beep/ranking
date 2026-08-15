import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import LikeDock from '@/components/engagement/LikeDock'
import { Shield } from 'lucide-react'
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
    <html lang="ko" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[#07070a] text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
        <Navbar />
        <main className="flex-grow flex flex-col relative">{children}</main>
        <LikeDock />
        <footer className="bg-[#050508] border-t border-white/[0.04] py-8 text-center text-xs text-slate-500 relative z-10">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-500/60" />
              <span className="font-bold text-slate-400">랭킹위키</span>
            </div>
            <p className="leading-relaxed">&copy; {new Date().getFullYear()} Ranking Wiki. All rights reserved. (P1 Discovery & Engagement Active)</p>
          </div>
        </footer>
      </body>
    </html>
  )
}
