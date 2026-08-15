import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '카테고리',
  description: '랭킹위키의 공개 카테고리와 세부 분야를 탐색합니다.',
  alternates: { canonical: '/categories' },
  robots: { index: true, follow: true },
}

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return children
}
