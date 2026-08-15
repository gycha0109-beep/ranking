import { createPublicClient } from '@/lib/supabase/public'

export type RankingHistoryChange = {
  itemId: string
  title: string
  slug: string
  beforePosition: number
  afterPosition: number
  delta: number
  direction: 'up' | 'down' | 'same'
  voteCount: number
  voteShare: number
}

export type RankingHistoryRevision = {
  revisionId: string
  revisionNumber: number
  changeType: 'vote_finalization' | 'vote_void'
  reason: string
  voteRound: number
  eligibleVoteCount: number
  createdAt: string
  changes: RankingHistoryChange[]
}

export async function getPublicRankingHistory(
  rankingId: string,
  limit = 10,
): Promise<RankingHistoryRevision[]> {
  if (!rankingId) return []

  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_ranking_history', {
    p_ranking_id: rankingId,
    p_limit: Math.min(Math.max(Math.trunc(limit), 1), 20),
  })

  if (error) {
    console.error('Failed to load ranking history:', error)
    return []
  }

  return ((data || []) as any[]).map((row) => ({
    revisionId: String(row.revision_id),
    revisionNumber: Number(row.revision_number),
    changeType: row.change_type === 'vote_void' ? 'vote_void' : 'vote_finalization',
    reason: String(row.reason || ''),
    voteRound: Number(row.vote_round),
    eligibleVoteCount: Number(row.eligible_vote_count),
    createdAt: String(row.created_at),
    changes: (Array.isArray(row.changes) ? row.changes : []).map((change: any) => ({
      itemId: String(change.item_id),
      title: String(change.title || ''),
      slug: String(change.slug || ''),
      beforePosition: Number(change.before_position),
      afterPosition: Number(change.after_position),
      delta: Number(change.delta),
      direction: change.direction === 'up' ? 'up' : change.direction === 'down' ? 'down' : 'same',
      voteCount: Number(change.vote_count),
      voteShare: Number(change.vote_share),
    })),
  }))
}
