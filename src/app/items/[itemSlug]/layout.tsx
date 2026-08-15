import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import CommentSection from '@/components/comments/CommentSection'
import { absoluteUrl, getItemSeoSnapshot, serializeJsonLd, SITE_NAME } from '@/lib/seo'

type Props = { children: ReactNode; params: Promise<{ itemSlug: string }> }

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { itemSlug } = await params
  const item = await getItemSeoSnapshot(itemSlug)
  if (!item) return { robots: { index: false, follow: false } }

  const title = item.title
  const description = item.description || `${item.title}의 정보와 포함된 공개 랭킹을 확인합니다.`
  const canonical = `/items/${item.slug}`
  const images = item.image_url ? [item.image_url] : undefined

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { type: 'website', siteName: SITE_NAME, title, description, url: canonical, images },
    twitter: { card: images ? 'summary_large_image' : 'summary', title, description, images },
  }
}

export default async function ItemDetailLayout({ children, params }: Props) {
  const { itemSlug } = await params
  const item = await getItemSeoSnapshot(itemSlug)
  const url = item ? absoluteUrl(`/items/${item.slug}`) : null
  const jsonLd = item && url ? [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': url,
      url,
      name: item.title,
      description: item.description || undefined,
      mainEntity: { '@type': 'Thing', '@id': `${url}#item`, name: item.title, description: item.description || undefined, image: item.image_url || undefined },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: item.title, item: url },
      ],
    },
  ] : null

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />}
      {children}
      {item && (
        <div className="rw-comment-shell bg-[#f6f7f9] px-3 pb-24 sm:px-4">
          <div className="mx-auto max-w-[860px]"><CommentSection targetType="item" targetId={item.id} pathname={`/items/${item.slug}`} /></div>
        </div>
      )}
    </>
  )
}
