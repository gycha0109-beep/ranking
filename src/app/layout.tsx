import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import { Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: '랭킹위키 (Ranking Wiki) - 신뢰받는 랭킹 아카이브',
  description: '다양한 카테고리의 비교 분석 정보, 순위 선정 기준 및 상세이유를 투명하게 공개하는 위키형 랭킹 아카이브 플랫폼',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[#07070a] text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
        {/* 네비게이션바 탑재 */}
        <Navbar />

        {/* 메인 콘텐츠 영역 */}
        <main className="flex-grow flex flex-col relative">
          {children}
        </main>

        {/* 푸터 영역 */}
        <footer className="bg-[#050508] border-t border-white/[0.04] py-8 text-center text-xs text-slate-500 relative z-10">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-500/60" />
              <span className="font-bold text-slate-400">랭킹위키 MVP</span>
            </div>
            <p className="leading-relaxed">
              &copy; {new Date().getFullYear()} Ranking Wiki. All rights reserved. (P0-Core Admin Loop Active)
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
