import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '검색',
  description: '랭킹위키의 공개 랭킹과 아이템을 검색합니다.',
  alternates: { canonical: '/search' },
  robots: { index: false, follow: true },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children
}
