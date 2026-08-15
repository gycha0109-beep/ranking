import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import CommentSection from '@/components/comments/CommentSection'
import RankingHistoryPanel from '@/components/ranking-history/RankingHistoryPanel'
import RankingVotingPanel from '@/components/voting/RankingVotingPanel'
import { absoluteUrl, getRankingSeoSnapshot, serializeJsonLd, SITE_NAME } from '@/lib/seo'
import { getPublicRankingHistory } from '@/lib/queries/ranking-history'
import { getPublicRankingVoteSummary, getViewerRankingVoteContext } from '@/lib/queries/voting'

type Props = { children: ReactNode; params: Promise<{ rankingSlug: string }> }

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
    openGraph: { type: 'article', siteName: SITE_NAME, title, description, url: canonical, publishedTime: ranking.published_at || undefined, modifiedTime: ranking.updated_at || undefined, images },
    twitter: { card: images ? 'summary_large_image' : 'summary', title, description, images },
  }
}

export default async function RankingDetailLayout({ children, params }: Props) {
  const { rankingSlug } = await params
  const ranking = await getRankingSeoSnapshot(rankingSlug)
  const history = ranking ? await getPublicRankingHistory(ranking.id, 10) : []

  const jsonLd = ranking ? [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      '@id': `${absoluteUrl(`/rankings/${ranking.slug}`)}#ranking`,
      name: ranking.title,
      description: ranking.summary,
      url: absoluteUrl(`/rankings/${ranking.slug}`),
      numberOfItems: ranking.entries.length,
      itemListElement: ranking.entries.map((entry: any) => ({ '@type': 'ListItem', position: entry.position, name: entry.item.title, url: absoluteUrl(`/items/${entry.item.slug}`), description: entry.reason })),
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

  let votingPanel = null
  if (ranking?.ranking_type === 'user_vote') {
    const [summary, viewer] = await Promise.all([getPublicRankingVoteSummary(ranking.id), getViewerRankingVoteContext(ranking.id)])
    const byItem = new Map(summary.map((row) => [row.item_id, row]))
    const candidates = ranking.entries.map((entry: any) => {
      const row = byItem.get(entry.item.id)
      return {
        itemId: entry.item.id,
        title: entry.item.title,
        slug: entry.item.slug,
        seedPosition: Number(entry.seed_position ?? row?.seed_position ?? entry.position),
        voteCount: Number(row?.vote_count ?? 0),
        voteShare: Number(row?.vote_share ?? 0),
        currentRank: Number(row?.current_rank ?? entry.position),
      }
    }).sort((a: any, b: any) => a.currentRank - b.currentRank || a.itemId.localeCompare(b.itemId))

    votingPanel = (
      <div className="bg-[#f6f7f9] px-3 pt-6 sm:px-4 sm:pt-8">
        <div className="mx-auto max-w-[860px]">
          <RankingVotingPanel
            rankingId={ranking.id}
            pathname={`/rankings/${ranking.slug}`}
            candidates={candidates}
            initialVotingState={summary[0]?.voting_state || 'closed'}
            initialMyVoteItemId={viewer.myVoteItemId}
            isAuthenticated={viewer.isAuthenticated}
            canManageVoting={viewer.canManageVoting}
          />
        </div>
      </div>
    )
  }

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />}
      {votingPanel}
      {children}
      {history.length > 0 && (
        <div className="bg-[#f6f7f9] px-3 pb-10 sm:px-4">
          <div className="mx-auto max-w-[860px]"><RankingHistoryPanel revisions={history} /></div>
        </div>
      )}
      {ranking && (
        <div className="rw-comment-shell bg-[#f6f7f9] px-3 pb-24 sm:px-4">
          <div className="mx-auto max-w-[860px]"><CommentSection targetType="ranking" targetId={ranking.id} pathname={`/rankings/${ranking.slug}`} /></div>
        </div>
      )}
    </>
  )
}
