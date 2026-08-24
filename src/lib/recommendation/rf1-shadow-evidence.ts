import { stableFingerprint } from './rf1-core'
import type { Rf1ShadowResult } from './rf1-shadow'

export type Rf1ShadowEvidenceRecord = {
  shadowRunId: string
  currentRankingId: string
  policyBundleVersion: string
  profileMaturity: 'EMPTY' | 'EMERGING' | 'ESTABLISHED'
  profileFingerprint: string
  sessionFingerprint: string | null
  referenceTime: string
  seed: string
  baselineRankingIds: string[]
  shadowRankingIds: string[]
  candidateCount: number
  changedPositionCount: number
  protectedIdentityCount: number
}

function assertTrimmed(value: string, label: string) {
  if (!value || value.trim() !== value) throw new Error(`${label} must be a non-empty trimmed string`)
}

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`${label} must not contain duplicate ranking IDs`)
}

export function createRf1ShadowEvidenceRecord(result: Rf1ShadowResult): Rf1ShadowEvidenceRecord {
  if (result.mode !== 'SHADOW') throw new Error('RF-1D accepts SHADOW results only')
  assertTrimmed(result.currentRankingId, 'currentRankingId')
  assertTrimmed(result.policyBundleVersion, 'policyBundleVersion')
  assertTrimmed(result.profileFingerprint, 'profileFingerprint')
  if (result.sessionFingerprint) assertTrimmed(result.sessionFingerprint, 'sessionFingerprint')
  assertTrimmed(result.seed, 'seed')
  if (!Number.isFinite(Date.parse(result.referenceTime))) throw new Error('referenceTime must be an ISO-compatible timestamp')
  if (!Number.isInteger(result.candidateCount) || result.candidateCount < 0) throw new Error('candidateCount must be a non-negative integer')
  if (result.baselineRankingIds.length !== result.candidateCount || result.shadowRankingIds.length !== result.candidateCount) {
    throw new Error('RF-1D candidate count must match baseline and shadow arrays')
  }
  if (!Number.isInteger(result.changedPositionCount) || result.changedPositionCount < 0 || result.changedPositionCount > result.candidateCount) {
    throw new Error('changedPositionCount is out of bounds')
  }
  if (!Number.isInteger(result.protectedIdentityCount) || result.protectedIdentityCount < 0 || result.protectedIdentityCount > result.candidateCount) {
    throw new Error('protectedIdentityCount is out of bounds')
  }

  const baselineRankingIds = result.baselineRankingIds.map((rankingId) => {
    assertTrimmed(rankingId, 'baseline ranking ID')
    return rankingId
  })
  const shadowRankingIds = result.shadowRankingIds.map((rankingId) => {
    assertTrimmed(rankingId, 'shadow ranking ID')
    return rankingId
  })
  assertUnique(baselineRankingIds, 'baselineRankingIds')
  assertUnique(shadowRankingIds, 'shadowRankingIds')

  const baselineSet = [...baselineRankingIds].sort()
  const shadowSet = [...shadowRankingIds].sort()
  if (baselineSet.join('\u0000') !== shadowSet.join('\u0000')) {
    throw new Error('RF-1D shadow result must preserve the complete baseline candidate set')
  }

  const computedChangedPositionCount = baselineRankingIds.reduce((count, rankingId, index) => (
    count + (shadowRankingIds[index] === rankingId ? 0 : 1)
  ), 0)
  if (computedChangedPositionCount !== result.changedPositionCount) {
    throw new Error('RF-1D changedPositionCount must match the supplied orderings')
  }

  const referenceTime = new Date(result.referenceTime).toISOString()
  const fingerprintPayload = {
    domain: 'rankingwiki:rf1-shadow-run:v1',
    currentRankingId: result.currentRankingId,
    policyBundleVersion: result.policyBundleVersion,
    profileMaturity: result.profileMaturity,
    profileFingerprint: result.profileFingerprint,
    sessionFingerprint: result.sessionFingerprint,
    referenceTime,
    seed: result.seed,
    baselineRankingIds,
    shadowRankingIds,
    candidateCount: result.candidateCount,
    changedPositionCount: result.changedPositionCount,
    protectedIdentityCount: result.protectedIdentityCount,
  }

  return {
    shadowRunId: stableFingerprint(fingerprintPayload),
    currentRankingId: result.currentRankingId,
    policyBundleVersion: result.policyBundleVersion,
    profileMaturity: result.profileMaturity,
    profileFingerprint: result.profileFingerprint,
    sessionFingerprint: result.sessionFingerprint,
    referenceTime,
    seed: result.seed,
    baselineRankingIds,
    shadowRankingIds,
    candidateCount: result.candidateCount,
    changedPositionCount: result.changedPositionCount,
    protectedIdentityCount: result.protectedIdentityCount,
  }
}
