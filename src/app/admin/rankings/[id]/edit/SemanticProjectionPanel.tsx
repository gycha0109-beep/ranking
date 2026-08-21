'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { AlertTriangle, GitCompareArrows, Save, Tags, Trash2 } from 'lucide-react'
import {
  clearRankingSemanticProjection,
  saveRankingSemanticProjection,
  type RankingSemanticAdvisory,
  type RankingSemanticWorkspace,
} from '@/lib/actions/ranking-semantic'

function relationLabel(relation: RankingSemanticAdvisory['relation']) {
  switch (relation) {
    case 'same_version':
      return '중복 가능성 높음'
    case 'same_view':
      return '같은 시리즈 · 다른 버전'
    case 'same_claim':
      return '같은 질문 · 다른 방식'
    case 'same_subject':
      return '같은 Subject'
  }
}

function relationClass(relation: RankingSemanticAdvisory['relation']) {
  if (relation === 'same_version') return 'border-amber-400/30 bg-amber-400/10 text-amber-200'
  if (relation === 'same_view') return 'border-sky-400/30 bg-sky-400/10 text-sky-200'
  if (relation === 'same_claim') return 'border-violet-400/30 bg-violet-400/10 text-violet-200'
  return 'border-white/10 bg-white/[0.04] text-slate-300'
}

function projectionJson(value: unknown) {
  return JSON.stringify(value && typeof value === 'object' ? value : {}, null, 2)
}

export default function SemanticProjectionPanel({
  initialWorkspace,
}: {
  initialWorkspace: RankingSemanticWorkspace
}) {
  const [workspace, setWorkspace] = useState(initialWorkspace)
  const [subjectKey, setSubjectKey] = useState(initialWorkspace.projection?.subject_key || '')
  const [intentKey, setIntentKey] = useState(initialWorkspace.projection?.intent_key || '')
  const [methodKey, setMethodKey] = useState(initialWorkspace.projection?.method_key || '')
  const [coordinatesJson, setCoordinatesJson] = useState(projectionJson(initialWorkspace.projection?.coordinates))
  const [versionCoordinatesJson, setVersionCoordinatesJson] = useState(projectionJson(initialWorkspace.projection?.version_coordinates))
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const syncWorkspace = (next: RankingSemanticWorkspace) => {
    setWorkspace(next)
    setSubjectKey(next.projection?.subject_key || '')
    setIntentKey(next.projection?.intent_key || '')
    setMethodKey(next.projection?.method_key || '')
    setCoordinatesJson(projectionJson(next.projection?.coordinates))
    setVersionCoordinatesJson(projectionJson(next.projection?.version_coordinates))
  }

  const handleSave = () => {
    setError(null)
    setMessage(null)

    startTransition(async () => {
      const result = await saveRankingSemanticProjection(workspace.ranking.id, {
        subject_key: subjectKey,
        intent_key: intentKey,
        method_key: methodKey,
        coordinates_json: coordinatesJson,
        version_coordinates_json: versionCoordinatesJson,
      })

      if ('error' in result && result.error) {
        setError(result.error)
        return
      }

      if ('workspace' in result && result.workspace) syncWorkspace(result.workspace)
      setMessage('Reviewed semantic projection을 저장했습니다. 발행 상태에는 영향을 주지 않습니다.')
    })
  }

  const handleClear = () => {
    if (!window.confirm('Semantic projection을 해제하고 이 랭킹을 unclassified 상태로 되돌리시겠습니까?')) return

    setError(null)
    setMessage(null)

    startTransition(async () => {
      const result = await clearRankingSemanticProjection(workspace.ranking.id)
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }

      if ('workspace' in result && result.workspace) syncWorkspace(result.workspace)
      setMessage('Semantic projection을 해제했습니다. 랭킹 원문과 발행 상태는 그대로 유지됩니다.')
    })
  }

  const projectionState = workspace.projection?.classification_state || 'unclassified'
  const duplicateCount = workspace.advisories.filter(item => item.relation === 'same_version').length

  return (
    <section className="mb-8 rounded-2xl border border-indigo-400/20 bg-indigo-400/[0.04] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-300">
            <Tags className="h-4 w-4" />
            <span className="text-[11px] font-black uppercase tracking-[0.12em]">IA-2B Semantic Projection</span>
          </div>
          <h2 className="mt-2 text-lg font-black tracking-[-0.02em] text-white">의미 좌표 입력 · 중복 Advisory</h2>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">
            이 정보는 작성 원본과 분리된 discovery metadata입니다. 분류하지 않거나 projection을 삭제해도 랭킹 저장·발행은 차단되지 않습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase text-slate-300">
            {projectionState}
          </span>
          {duplicateCount > 0 && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black text-amber-200">
              duplicate advisory {duplicateCount}
            </span>
          )}
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs font-bold text-rose-200">{error}</div>}
      {message && <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs font-bold text-emerald-200">{message}</div>}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="text-[11px] font-bold text-slate-400">Subject key *</span>
          <input
            value={subjectKey}
            onChange={event => setSubjectKey(event.target.value)}
            placeholder="mens-fragrance"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 outline-none transition focus:border-indigo-400"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-slate-400">Intent key</span>
          <input
            value={intentKey}
            onChange={event => setIntentKey(event.target.value)}
            placeholder="recommendation"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 outline-none transition focus:border-indigo-400"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-slate-400">Method / View key</span>
          <input
            value={methodKey}
            onChange={event => setMethodKey(event.target.value)}
            placeholder="editorial"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 outline-none transition focus:border-indigo-400"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="text-[11px] font-bold text-slate-400">Coordinates JSON</span>
          <textarea
            value={coordinatesJson}
            onChange={event => setCoordinatesJson(event.target.value)}
            rows={6}
            spellCheck={false}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-[11px] leading-5 text-slate-200 outline-none transition focus:border-indigo-400"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-slate-400">Version coordinates JSON</span>
          <textarea
            value={versionCoordinatesJson}
            onChange={event => setVersionCoordinatesJson(event.target.value)}
            rows={6}
            spellCheck={false}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-[11px] leading-5 text-slate-200 outline-none transition focus:border-indigo-400"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {isPending ? '처리 중...' : 'Reviewed projection 저장'}
        </button>
        {workspace.projection && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:border-rose-400/30 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Projection 해제
          </button>
        )}
        <span className="text-[10px] font-semibold text-slate-500">AI/embedding 없이 운영자가 명시적으로 검토한 좌표만 저장합니다.</span>
      </div>

      <div className="mt-6 border-t border-white/[0.07] pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-black text-slate-200">Identity / Duplicate advisory</h3>
          </div>
          <span className="text-[10px] font-semibold text-slate-500">경고 전용 · 저장/발행 hard block 없음</span>
        </div>

        {!workspace.projection ? (
          <p className="mt-3 text-xs leading-6 text-slate-500">현재 unclassified 상태입니다. Advisory도 생성하지 않습니다.</p>
        ) : workspace.advisories.length === 0 ? (
          <p className="mt-3 text-xs leading-6 text-slate-500">현재 Subject 안에서 identity relation이 확인된 다른 랭킹이 없습니다.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {workspace.advisories.map(advisory => (
              <div key={advisory.ranking_id} className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {advisory.relation === 'same_version' && <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />}
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${relationClass(advisory.relation)}`}>
                      {relationLabel(advisory.relation)}
                    </span>
                    <span className="text-[9px] font-bold uppercase text-slate-500">{advisory.status}</span>
                  </div>
                  <p className="mt-1.5 truncate text-xs font-extrabold text-slate-200">{advisory.title}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{advisory.reason}</p>
                </div>
                <Link
                  href={`/admin/rankings/${advisory.ranking_id}/edit`}
                  className="shrink-0 text-[10px] font-black text-indigo-300 hover:text-indigo-200"
                >
                  비교 열기 →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
