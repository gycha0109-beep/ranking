import Link from 'next/link'
import { ArrowLeft, Flag, ShieldCheck } from 'lucide-react'
import CommentReportQueue from './CommentReportQueue'
import { loadCommentReportQueue } from '@/lib/actions/comment-report-admin'

export const dynamic = 'force-dynamic'

export default async function CommentReportPage() {
  const result = await loadCommentReportQueue()

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
            <div className="flex items-center gap-2 text-rose-300">
              <Flag className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-widest">Comment Reports</span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">댓글 신고·운영 제재 대기열</h1>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-500 sm:text-sm">
              사용자 신고를 댓글 단위 사건으로 집계해 검토합니다. 신고 수만으로 자동 제재하지 않으며, 숨김·차단·작성자 경고는 관리자 판단과 감사 메모를 통해서만 기록됩니다.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            신고자 비식별 · 처리 기록 Append-only
          </div>
        </div>

        <CommentReportQueue initialRows={result.data} initialError={result.error} />
      </div>
    </div>
  )
}
