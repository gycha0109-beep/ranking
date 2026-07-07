'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { publishRanking, unpublishRanking, approveModeration } from '@/lib/actions/admin'
import { 
  ShieldCheck, 
  AlertTriangle, 
  Check, 
  X, 
  Sparkles, 
  FileEdit,
  Eye,
  RefreshCw,
  Award
} from 'lucide-react'

interface Props {
  rankingId: string
  rankingSlug: string
  status: 'draft' | 'published' | 'archived'
  validation: {
    hasTitle: boolean
    hasCategory: boolean
    hasSummary: boolean
    hasScope: boolean
    hasEntries: boolean
    hasCriteria: boolean
  }
  isPublishable: boolean
  moderationStatus: string
  moderationReason: string
}

export default function PreviewControlPanel({
  rankingId,
  rankingSlug,
  status,
  validation,
  isPublishable,
  moderationStatus,
  moderationReason
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handlePublish = async () => {
    setErrorMessage(null)
    setSuccessMessage(null)

    startTransition(async () => {
      const result = await publishRanking(rankingId)
      if (result.error) {
        setErrorMessage(result.error)
      } else {
        setSuccessMessage('랭킹 문서가 성공적으로 발행되어 대중에게 공개 노출됩니다!')
        router.refresh()
      }
    })
  }

  const handleUnpublish = async () => {
    setErrorMessage(null)
    setSuccessMessage(null)

    startTransition(async () => {
      const result = await unpublishRanking(rankingId)
      if (result.error) {
        setErrorMessage(result.error)
      } else {
        setSuccessMessage('발행이 성공적으로 취소되었으며, 비로그인 유저의 조회가 차단되었습니다.')
        router.refresh()
      }
    })
  }

  const handleApproveModeration = async () => {
    setErrorMessage(null)
    setSuccessMessage(null)

    startTransition(async () => {
      const result = await approveModeration(rankingId)
      if (result.error) {
        setErrorMessage(result.error)
      } else {
        setSuccessMessage('콘텐츠 검열 심사가 수동 승인(Clean) 처리되었습니다!')
        router.refresh()
      }
    })
  }

  const isApproved = moderationStatus === 'clean' || moderationStatus === 'suggestive'

  return (
    <div className="rounded-3xl border border-indigo-500/20 bg-indigo-950/10 p-5 sm:p-6 backdrop-blur-xl space-y-6">
      
      {/* 타이틀 및 현황 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4.5 h-4.5 text-indigo-400" />
            E2E 최종 발행 통제 센터
          </h2>
          <p className="text-[11px] text-slate-400 mt-1">
            서버 사이드 비즈니스 유효성 검사 및 콘텐츠 검열 필터를 실시간으로 확인하고 공개 발행 승인을 진행합니다.
          </p>
        </div>
        
        {/* 상태 배지 */}
        <div>
          {status === 'published' ? (
            <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              발행 상태 (PUBLISHED)
            </span>
          ) : (
            <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-amber-500/10 border border-amber-500/20 text-amber-400">
              드래프트 상태 (DRAFT)
            </span>
          )}
        </div>
      </div>

      {/* Moderation 경고 및 알림 표시 */}
      {moderationStatus === 'blocked' && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs font-bold flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>[경고] 민감/유해 단어 감지로 인해 이 문서의 발행이 차단(blocked)되었습니다.</span>
          </div>
          <span className="text-[10px] text-red-400 pl-6 block">감지 사유: {moderationReason}</span>
        </div>
      )}
      {moderationStatus === 'needs_review' && (
        <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 text-yellow-300 text-xs font-bold flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
            <span>[알림] 이 문서는 검토 대기(needs_review) 상태입니다. 관리자 검증 완료 후 발행할 수 있습니다.</span>
          </div>
          <span className="text-[10px] text-yellow-400 pl-6 block">검토 사유: {moderationReason}</span>
        </div>
      )}
      {moderationStatus === 'suggestive' && (
        <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-300 text-xs font-bold flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <span>[참고] 이 문서는 약간의 선정성/민감성 표현(suggestive)을 포함하고 있습니다. 발행은 가능합니다.</span>
          </div>
          <span className="text-[10px] text-purple-400 pl-6 block">감지 사유: {moderationReason}</span>
        </div>
      )}

      {/* 내부 피드백 출력 */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 검증 체크리스트 및 액션 버튼 병렬 배치 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 체크리스트 영역 */}
        <div className="md:col-span-2 space-y-2">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">
            자가 정밀 검증 사항 (Checklist)
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-xs">
              {validation.hasTitle ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <X className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className={validation.hasTitle ? 'text-slate-300' : 'text-slate-500 line-through'}>
                기본 정보 및 제목 입력 완료
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {validation.hasCategory ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <X className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className={validation.hasCategory ? 'text-slate-300' : 'text-slate-500 line-through'}>
                대분류 카테고리 매핑 완료
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {validation.hasSummary ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <X className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className={validation.hasSummary ? 'text-slate-300' : 'text-slate-500 line-through'}>
                한 줄 소개 요약 작성 완료
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {validation.hasScope ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <X className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className={validation.hasScope ? 'text-slate-300' : 'text-slate-500 line-through'}>
                조사 범위(Scope) target 입력 완료
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {validation.hasCriteria ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <X className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className={validation.hasCriteria ? 'text-slate-300' : 'text-slate-500 line-through'}>
                판정 기준(Criteria) 최소 1개 등록
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {validation.hasEntries ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <X className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className={validation.hasEntries ? 'text-slate-300' : 'text-slate-500 line-through'}>
                순위표 항목(Entries) 최소 1개 연결
              </span>
            </div>

            {/* Moderation 심사 추가 */}
            <div className="flex items-center gap-2 text-xs col-span-1 sm:col-span-2 border-t border-white/5 pt-2 mt-1">
              {isApproved ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <X className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className={isApproved ? 'text-slate-300' : 'text-rose-400 font-bold'}>
                {moderationStatus === 'blocked' && `콘텐츠 검열 차단됨 (blocked: ${moderationReason})`}
                {moderationStatus === 'needs_review' && `검토 대기 상태 (needs_review: ${moderationReason})`}
                {isApproved && `콘텐츠 검열 통과 (${moderationStatus})`}
              </span>
            </div>
          </div>
        </div>

        {/* 제어 버튼 영역 */}
        <div className="md:col-span-1 flex flex-col justify-center border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6 space-y-3">
          {status === 'draft' ? (
            <>
              <button
                type="button"
                onClick={handlePublish}
                disabled={!isPublishable || isPending}
                className="w-full py-3 px-4 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/15"
              >
                {isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                최종 발행 승인 (Publish)
              </button>
              
              {!isPublishable && (
                <p className="text-[10px] text-rose-400 font-bold text-center leading-normal">
                  * 좌측 자가 검증 및 검열 통과가 모두 완료되어야 발행이 허용됩니다.
                </p>
              )}

              {/* 수동 승인 버튼 (needs_review 또는 blocked 일 때 어드민 오버라이드용) */}
              {!isApproved && (
                <button
                  type="button"
                  onClick={handleApproveModeration}
                  disabled={isPending}
                  className="w-full py-2 px-4 rounded-xl text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-indigo-500/20 text-indigo-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  수동 검토 승인 (Force Clean)
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={handleUnpublish}
              disabled={isPending}
              className="w-full py-3 px-4 rounded-xl text-xs font-black bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/15"
            >
              {isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileEdit className="w-3.5 h-3.5" />
              )}
              발행 취소하기 (Draft 강제 복원)
            </button>
          )}

          {status === 'published' && (
            <Link
              href={`/rankings/${rankingSlug}`} // 발행된 경우 공개 경로가 유효하므로 직접 상세 링크로 이동해서 검수 가능
              target="_blank"
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-slate-300 text-center transition-all flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              공식 발행 상세 화면
            </Link>
          )}
        </div>

      </div>

    </div>
  )
}
