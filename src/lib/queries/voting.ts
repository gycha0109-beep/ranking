import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'

export type RankingVoteSummaryRow = {
  item_id: string
  seed_position: number
  vote_count: number
  total_votes: number
  vote_share: number
  current_rank: number
  voting_state: 'open' | 'closed'
}

export async function getPublicRankingVoteSummary(rankingId: string): Promise<RankingVoteSummaryRow[]> {
  if (!rankingId) return []

  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_ranking_vote_summary', {
    p_ranking_id: rankingId,
  })

  if (error) {
    console.error('Failed to load ranking vote summary:', error)
    return []
  }

  return ((data || []) as any[]).map((row) => ({
    item_id: String(row.item_id),
    seed_position: Number(row.seed_position),
    vote_count: Number(row.vote_count),
    total_votes: Number(row.total_votes),
    vote_share: Number(row.vote_share),
    current_rank: Number(row.current_rank),
    voting_state: row.voting_state === 'open' ? 'open' : 'closed',
  }))
}

export async function getViewerRankingVoteContext(rankingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      isAuthenticated: false,
      myVoteItemId: null as string | null,
      canManageVoting: false,
    }
  }

  const [{ data: myVote, error: voteError }, { data: adminAccess, error: accessError }] = await Promise.all([
    supabase.rpc('get_my_ranking_vote', { p_ranking_id: rankingId }),
    supabase.rpc('get_my_admin_access'),
  ])

  if (voteError) console.error('Failed to load current user vote:', voteError)
  if (accessError) console.error('Failed to load admin access for voting:', accessError)

  const capabilities = Array.isArray((adminAccess as any)?.capabilities)
    ? (adminAccess as any).capabilities
    : []

  return {
    isAuthenticated: true,
    myVoteItemId: voteError ? null : ((myVote as string | null) || null),
    canManageVoting: capabilities.includes('content_manage'),
  }
}
