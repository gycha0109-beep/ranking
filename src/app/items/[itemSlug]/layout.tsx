import type { ReactNode } from 'react'
import CommentSection from '@/components/comments/CommentSection'
import { createClient } from '@/lib/supabase/server'

type Props = {
  children: ReactNode
  params: Promise<{ itemSlug: string }>
}

export default async function ItemDetailLayout({ children, params }: Props) {
  const { itemSlug } = await params
  const supabase = await createClient()
  const { data: item } = await supabase
    .from('items')
    .select('id, slug')
    .eq('slug', itemSlug)
    .eq('status', 'active')
    .in('moderation_status', ['clean', 'suggestive'])
    .in('image_moderation_status', ['clean', 'suggestive'])
    .maybeSingle()

  return (
    <>
      {children}
      {item && (
        <div className="bg-[#07070a] px-4 pb-24 text-slate-100 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <CommentSection
              targetType="item"
              targetId={item.id}
              pathname={`/items/${item.slug}`}
            />
          </div>
        </div>
      )}
    </>
  )
}
