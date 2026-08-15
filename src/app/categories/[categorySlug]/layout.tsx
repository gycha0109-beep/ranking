import type { Metadata } from 'next'
import { getCategorySeoSnapshot, SITE_NAME } from '@/lib/seo'

type Props = {
  children: React.ReactNode
  params: Promise<{ categorySlug: string }>
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { categorySlug } = await params
  const category = await getCategorySeoSnapshot(categorySlug)
  if (!category) return { robots: { index: false, follow: false } }

  const title = `${category.name} 랭킹`
  const description = category.description || `${category.name} 분야의 공개 랭킹과 비교 정보를 탐색합니다.`
  const canonical = `/categories/${category.slug}`
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { type: 'website', siteName: SITE_NAME, title, description, url: canonical },
    twitter: { card: 'summary', title, description },
  }
}

export default function CategoryLayout({ children }: Props) {
  return children
}
