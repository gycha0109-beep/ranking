import type { ReactNode } from 'react'
import CommentSection from '@/components/comments/CommentSection'
import { createClient } from '@/lib/supabase/server'

type Props = {
  children: ReactNode
  params: Promise<{ rankingSlug: string }>
}

export default async function RankingDetailLayout({ children, params }: Props) {
  const { rankingSlug } = await params
  const supabase = await createClient()
  const { data: ranking } = await supabase
    .from('rankings')
    .select('id, slug')
    .eq('slug', rankingSlug)
    .eq('status', 'published')
    .in('moderation_status', ['clean', 'suggestive'])
    .in('image_moderation_status', ['clean', 'suggestive'])
    .maybeSingle()

  return (
    <>
      {children}
      {ranking && (
        <div className="bg-[#07070a] px-4 pb-24 text-slate-100 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <CommentSection
              targetType="ranking"
              targetId={ranking.id}
              pathname={`/rankings/${ranking.slug}`}
            />
          </div>
        </div>
      )}
    </>
  )
}
