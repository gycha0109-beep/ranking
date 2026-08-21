'use client'

import { useEffect, useMemo, useState } from 'react'
import { Network } from 'lucide-react'
import type { RankingSemanticWorkspace } from '@/lib/actions/ranking-semantic'
import type { RankingSubjectContextSuggestion } from '@/lib/ranking-subject-context'
import {
  normalizeRankingSubjectLookup,
  rankRankingSubjectSuggestions,
} from '@/lib/ranking-subject-suggestions'
import SemanticProjectionPanel from './SemanticProjectionPanel'

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  if (!setter) return false
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

export default function SemanticProjectionWithContext({
  initialWorkspace,
  contextSuggestions,
}: {
  initialWorkspace: RankingSemanticWorkspace
  contextSuggestions: RankingSubjectContextSuggestion[]
}) {
  const [subjectQuery, setSubjectQuery] = useState(initialWorkspace.projection?.subject_key || '')

  useEffect(() => {
    const input = document.getElementById('semantic-subject-key') as HTMLInputElement | null
    if (!input) return

    const sync = () => setSubjectQuery(input.value)
    sync()
    input.addEventListener('input', sync)
    return () => input.removeEventListener('input', sync)
  }, [])

  const normalizedSubjectKey = normalizeRankingSubjectLookup(subjectQuery)
  const lexicalSuggestions = useMemo(
    () => rankRankingSubjectSuggestions(subjectQuery, initialWorkspace.subject_options)
      .filter(suggestion => suggestion.subject_key !== normalizedSubjectKey),
    [subjectQuery, normalizedSubjectKey, initialWorkspace.subject_options]
  )

  const exactAlias = initialWorkspace.subject_aliases.some(
    alias => alias.alias_key === normalizedSubjectKey
  )
  const contextSuggestion = normalizedSubjectKey.length >= 2
    && !exactAlias
    && lexicalSuggestions.length === 0
    ? contextSuggestions.find(suggestion => suggestion.subject_key !== normalizedSubjectKey) || null
    : null

  const handleUseContextSuggestion = () => {
    if (!contextSuggestion) return
    const input = document.getElementById('semantic-subject-key') as HTMLInputElement | null
    if (!input) return
    if (!setNativeInputValue(input, contextSuggestion.subject_key)) return
    input.focus()
  }

  return (
    <>
      <SemanticProjectionPanel initialWorkspace={initialWorkspace} />

      {contextSuggestion && (
        <section className="mb-8 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-cyan-300">
                <Network className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.12em]">IA-2H bounded context fallback</span>
              </div>
              <p className="mt-2 text-sm font-black text-slate-100">{contextSuggestion.subject_key}</p>
              <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-400">
                문자열 matcher가 abstain한 상태에서만 표시됩니다. 같은 subcategory의 기존 랭킹 중
                {' '}{contextSuggestion.supporting_ranking_count}개가 반복된 Item neighborhood로 이 Subject를 지지하고,
                경쟁 Subject support가 없어 fallback 후보로 노출합니다.
              </p>
              <p className="mt-2 text-[10px] text-slate-500">
                최대 공통 Item {contextSuggestion.max_shared_item_count}개 · 자동 저장/병합 없음 · 선택하지 않아도 새 Subject 저장 가능
              </p>
            </div>
            <button
              type="button"
              onClick={handleUseContextSuggestion}
              className="shrink-0 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-[10px] font-black text-cyan-100 transition hover:bg-cyan-300/20"
            >
              Subject 입력에 사용
            </button>
          </div>
        </section>
      )}
    </>
  )
}
