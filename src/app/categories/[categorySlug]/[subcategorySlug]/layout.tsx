import type { Metadata } from 'next'
import { getSubcategorySeoSnapshot, SITE_NAME } from '@/lib/seo'

type Props = {
  children: React.ReactNode
  params: Promise<{ categorySlug: string; subcategorySlug: string }>
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { categorySlug, subcategorySlug } = await params
  const subcategory = await getSubcategorySeoSnapshot(categorySlug, subcategorySlug)
  if (!subcategory) return { robots: { index: false, follow: false } }

  const title = `${subcategory.name} 랭킹`
  const description = subcategory.description || `${subcategory.name} 분야의 공개 랭킹과 비교 정보를 탐색합니다.`
  const canonical = `/categories/${categorySlug}/${subcategory.slug}`
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { type: 'website', siteName: SITE_NAME, title, description, url: canonical },
    twitter: { card: 'summary', title, description },
  }
}

export default function SubcategoryLayout({ children }: Props) {
  return children
}
