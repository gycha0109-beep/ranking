'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { AlertTriangle, GitCompareArrows, Link2, Save, Tags, Trash2, Unlink } from 'lucide-react'
import {
  clearRankingSemanticProjection,
  createRankingSubjectAlias,
  deleteRankingSubjectAlias,
  saveRankingSemanticProjection,
  type RankingSemanticAdvisory,
  type RankingSemanticWorkspace,
} from '@/lib/actions/ranking-semantic'
import {
  normalizeRankingSubjectLookup,
  rankRankingSubjectSuggestions,
} from '@/lib/ranking-subject-suggestions'

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

function evidenceSuffix(result: { evidence_warning?: string | null }) {
  return result.evidence_warning ? ` · ${result.evidence_warning}` : ''
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
  const [selectedSuggestion, setSelectedSuggestion] = useState<{ query: string; key: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const normalizedSubjectKey = normalizeRankingSubjectLookup(subjectKey)
  const exactAlias = workspace.subject_aliases.find(alias => alias.alias_key === normalizedSubjectKey)
  const effectiveCanonicalKey = exactAlias?.canonical_subject_key || normalizedSubjectKey
  const suggestions = useMemo(
    () => rankRankingSubjectSuggestions(subjectKey, workspace.subject_options)
      .filter(suggestion => suggestion.subject_key !== normalizedSubjectKey),
    [subjectKey, normalizedSubjectKey, workspace.subject_options]
  )
  const currentAliases = workspace.subject_aliases
    .filter(alias => alias.canonical_subject_key === effectiveCanonicalKey)
    .sort((left, right) => left.alias_key.localeCompare(right.alias_key))

  const syncWorkspace = (next: RankingSemanticWorkspace, preserveSubject = false) => {
    setWorkspace(next)
    if (!preserveSubject) setSubjectKey(next.projection?.subject_key || '')
    setIntentKey(next.projection?.intent_key || '')
    setMethodKey(next.projection?.method_key || '')
    setCoordinatesJson(projectionJson(next.projection?.coordinates))
    setVersionCoordinatesJson(projectionJson(next.projection?.version_coordinates))
    setSelectedSuggestion(null)
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
      }, {
        suggestion_query: selectedSuggestion?.query || null,
        selected_suggestion_key: selectedSuggestion?.key || null,
      })

      if ('error' in result && result.error) {
        setError(result.error)
        return
      }

      if ('workspace' in result && result.workspace) syncWorkspace(result.workspace)
      const suffix = evidenceSuffix(result)
      if ('subject_resolution' in result && result.subject_resolution?.resolution_kind === 'suggestion') {
        setMessage(`Deterministic suggestion ${result.subject_resolution.canonical_subject_key} 선택을 포함해 reviewed projection을 저장했습니다.${suffix}`)
      } else if ('subject_resolution' in result && result.subject_resolution?.resolved_via_alias) {
        setMessage(`Alias ${result.subject_resolution.input_subject_key} → ${result.subject_resolution.canonical_subject_key}로 정규화해 저장했습니다. 발행 상태에는 영향을 주지 않습니다.${suffix}`)
      } else {
        setMessage(`Reviewed semantic projection을 저장했습니다. 발행 상태에는 영향을 주지 않습니다.${suffix}`)
      }
    })
  }

  const handleUseCanonical = (canonicalSubjectKey: string) => {
    setSelectedSuggestion({ query: subjectKey, key: canonicalSubjectKey })
    setSubjectKey(canonicalSubjectKey)
    setError(null)
    setMessage(`기존 Canonical Subject ${canonicalSubjectKey}를 선택했습니다. 저장 시 IA-2D finalized-decision 증거에 반영됩니다.`)
  }

  const handleCreateAlias = (canonicalSubjectKey: string) => {
    const aliasKey = normalizeRankingSubjectLookup(subjectKey)
    if (!aliasKey || aliasKey === canonicalSubjectKey) return
    if (!window.confirm(`${aliasKey}를 ${canonicalSubjectKey}의 reviewed Alias로 등록하시겠습니까?`)) return

    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await createRankingSubjectAlias(workspace.ranking.id, aliasKey, canonicalSubjectKey)
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      if ('workspace' in result && result.workspace) {
        syncWorkspace(result.workspace, true)
        setSubjectKey(canonicalSubjectKey)
      }
      setSelectedSuggestion(null)
      setMessage(`Alias ${aliasKey} → ${canonicalSubjectKey}를 등록했습니다. 이후 exact alias 입력은 canonical key로 저장됩니다.${evidenceSuffix(result)}`)
    })
  }

  const handleDeleteAlias = (aliasKey: string) => {
    if (!window.confirm(`${aliasKey} Alias 연결을 해제하시겠습니까? 기존 projection은 자동 변경되지 않습니다.`)) return

    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await deleteRankingSubjectAlias(workspace.ranking.id, aliasKey)
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      if ('workspace' in result && result.workspace) syncWorkspace(result.workspace, true)
      setMessage(`Alias ${aliasKey} 연결을 해제했습니다.${evidenceSuffix(result)}`)
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
      setMessage(`Semantic projection을 해제했습니다. 랭킹 원문과 발행 상태는 그대로 유지됩니다.${evidenceSuffix(result)}`)
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
            <span className="text-[11px] font-black uppercase tracking-[0.12em]">IA-2C Canonical Subject</span>
          </div>
          <h2 className="mt-2 text-lg font-black tracking-[-0.02em] text-white">의미 좌표 · Canonical 재사용 · Alias Advisory</h2>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">
            기존 Subject 재사용을 우선 제안하지만 새 Subject를 그대로 만드는 것도 허용합니다. 분류하지 않거나 projection을 삭제해도 랭킹 저장·발행은 차단되지 않습니다.
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
        <div className="block">
          <label htmlFor="semantic-subject-key" className="text-[11px] font-bold text-slate-400">Subject key *</label>
          <input
            id="semantic-subject-key"
            value={subjectKey}
            onChange={event => {
              setSubjectKey(event.target.value)
              setSelectedSuggestion(null)
            }}
            placeholder="mens-fragrance"
            autoComplete="off"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 outline-none transition focus:border-indigo-400"
          />
          {exactAlias && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/10 px-2.5 py-2 text-[10px] text-sky-200">
              <Link2 className="h-3 w-3 shrink-0" />
              exact Alias → <strong>{exactAlias.canonical_subject_key}</strong>
            </div>
          )}
          {normalizedSubjectKey.length >= 2 && suggestions.length > 0 && (
            <div className="mt-2 space-y-1.5 rounded-xl border border-white/[0.08] bg-black/20 p-2">
              <p className="px-1 text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">Deterministic suggestions</p>
              {suggestions.map(suggestion => (
                <div key={suggestion.subject_key} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-black text-slate-200">{suggestion.subject_key}</p>
                    <p className="mt-0.5 text-[9px] text-slate-500">
                      사용 {suggestion.usage_count}회
                      {suggestion.matched_by === 'alias' ? ` · alias ${suggestion.matched_key} 매칭` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleUseCanonical(suggestion.subject_key)}
                      className="rounded-md border border-indigo-400/25 bg-indigo-400/10 px-2 py-1 text-[9px] font-black text-indigo-200 hover:bg-indigo-400/20 disabled:opacity-50"
                    >
                      사용
                    </button>
                    {normalizedSubjectKey && normalizedSubjectKey !== suggestion.subject_key && !exactAlias && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleCreateAlias(suggestion.subject_key)}
                        className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-black text-slate-300 hover:border-sky-400/30 hover:text-sky-200 disabled:opacity-50"
                      >
                        Alias 연결
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <p className="px-1 pt-1 text-[9px] leading-4 text-slate-600">제안을 선택하지 않아도 입력한 새 Subject를 그대로 저장할 수 있습니다.</p>
            </div>
          )}
        </div>
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

      {effectiveCanonicalKey && currentAliases.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/15 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-black text-slate-300">{effectiveCanonicalKey} reviewed aliases</p>
            <span className="text-[9px] text-slate-600">alias 삭제는 기존 projection을 역변환하지 않습니다.</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {currentAliases.map(alias => (
              <span key={alias.alias_key} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[9px] font-bold text-slate-300">
                {alias.alias_key}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDeleteAlias(alias.alias_key)}
                  className="text-slate-500 hover:text-rose-300 disabled:opacity-50"
                  aria-label={`${alias.alias_key} Alias 삭제`}
                >
                  <Unlink className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

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
        <span className="text-[10px] font-semibold text-slate-500">AI/embedding 없이 실제 사용 Subject + reviewed Alias만으로 제안합니다. IA-2D는 저장된 결정만 append-only 증거로 집계합니다.</span>
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
