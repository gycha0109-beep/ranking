import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import CommentSection from '@/components/comments/CommentSection'
import { absoluteUrl, getRankingSeoSnapshot, serializeJsonLd, SITE_NAME } from '@/lib/seo'

type Props = {
  children: ReactNode
  params: Promise<{ rankingSlug: string }>
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { rankingSlug } = await params
  const ranking = await getRankingSeoSnapshot(rankingSlug)
  if (!ranking) return { robots: { index: false, follow: false } }

  const title = ranking.seo_title || ranking.title
  const description = ranking.seo_description || ranking.summary
  const canonical = `/rankings/${ranking.slug}`
  const images = ranking.cover_image_url ? [ranking.cover_image_url] : undefined

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      title,
      description,
      url: canonical,
      publishedTime: ranking.published_at || undefined,
      modifiedTime: ranking.updated_at || undefined,
      images,
    },
    twitter: { card: images ? 'summary_large_image' : 'summary', title, description, images },
  }
}

export default async function RankingDetailLayout({ children, params }: Props) {
  const { rankingSlug } = await params
  const ranking = await getRankingSeoSnapshot(rankingSlug)

  const jsonLd = ranking ? [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      '@id': `${absoluteUrl(`/rankings/${ranking.slug}`)}#ranking`,
      name: ranking.title,
      description: ranking.summary,
      url: absoluteUrl(`/rankings/${ranking.slug}`),
      numberOfItems: ranking.entries.length,
      itemListElement: ranking.entries.map((entry: any) => ({
        '@type': 'ListItem',
        position: entry.position,
        name: entry.item.title,
        url: absoluteUrl(`/items/${entry.item.slug}`),
        description: entry.reason,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: absoluteUrl('/') },
        ...(ranking.category ? [{ '@type': 'ListItem', position: 2, name: ranking.category.name, item: absoluteUrl(`/categories/${ranking.category.slug}`) }] : []),
        ...(ranking.subcategory ? [{ '@type': 'ListItem', position: ranking.category ? 3 : 2, name: ranking.subcategory.name, item: absoluteUrl(`/categories/${ranking.category?.slug || ''}/${ranking.subcategory.slug}`) }] : []),
        { '@type': 'ListItem', position: (ranking.category ? 2 : 1) + (ranking.subcategory ? 1 : 0) + 1, name: ranking.title, item: absoluteUrl(`/rankings/${ranking.slug}`) },
      ],
    },
  ] : null

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />}
      {children}
      {ranking && (
        <div className="bg-[#07070a] px-4 pb-24 text-slate-100 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <CommentSection targetType="ranking" targetId={ranking.id} pathname={`/rankings/${ranking.slug}`} />
          </div>
        </div>
      )}
    </>
  )
}
