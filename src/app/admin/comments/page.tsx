import Link from 'next/link'
import { ArrowLeft, MessageSquare, ShieldCheck } from 'lucide-react'
import CommentModerationQueue from './CommentModerationQueue'
import { loadCommentModerationQueue } from '@/lib/actions/comment-admin'

export const dynamic = 'force-dynamic'

export default async function CommentModerationPage() {
  const result = await loadCommentModerationQueue()

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-5 border-b border-white/[0.06] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/admin"
              className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              어드민 통제 본부
            </Link>
            <div className="flex items-center gap-2 text-indigo-300">
              <MessageSquare className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-widest">Comment Moderation</span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">댓글 검토 대기열</h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-500 sm:text-sm">
              자동 Moderation이 검토 또는 차단으로 분류한 댓글의 원문, 대상, 판정 이력을 확인하고 최종 공개 상태를 결정합니다.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            관리자 전용 · 감사 이력 Append-only
          </div>
        </div>

        <CommentModerationQueue initialRows={result.data} initialError={result.error} />
      </div>
    </div>
  )
}
