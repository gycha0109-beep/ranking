export const RANKING_SUBJECT_SUGGESTION_LIMIT = 5

export type RankingSubjectAlias = {
  alias_key: string
  canonical_subject_key: string
  created_at?: string | null
}

export type RankingSubjectOption = {
  subject_key: string
  usage_count: number
  aliases: string[]
}

export type RankingSubjectSuggestion = RankingSubjectOption & {
  score: number
  matched_by: 'canonical' | 'alias'
  matched_key: string
}

export function normalizeRankingSubjectLookup(value: string | null | undefined) {
  return (value || '').normalize('NFKC').trim().toLowerCase()
}

function tokens(value: string) {
  return new Set(value.split(/[._/-]+/g).filter(Boolean))
}

function trigramSet(value: string) {
  const normalized = `  ${value}  `
  const grams = new Set<string>()
  for (let index = 0; index <= normalized.length - 3; index += 1) {
    grams.add(normalized.slice(index, index + 3))
  }
  return grams
}

function diceSimilarity(left: string, right: string) {
  if (left === right) return 1
  const leftGrams = trigramSet(left)
  const rightGrams = trigramSet(right)
  if (leftGrams.size === 0 || rightGrams.size === 0) return 0

  let shared = 0
  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) shared += 1
  }
  return (2 * shared) / (leftGrams.size + rightGrams.size)
}

function tokenSimilarity(left: string, right: string) {
  const leftTokens = tokens(left)
  const rightTokens = tokens(right)
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0

  let shared = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1
  }
  return shared / Math.max(leftTokens.size, rightTokens.size)
}

function scoreKey(query: string, candidate: string) {
  if (!query || !candidate) return 0
  if (query === candidate) return 10_000

  const lengthGap = Math.abs(query.length - candidate.length)
  if (candidate.startsWith(query) || query.startsWith(candidate)) {
    return 8_000 - Math.min(lengthGap, 500)
  }
  if (candidate.includes(query) || query.includes(candidate)) {
    return 6_500 - Math.min(lengthGap, 500)
  }

  const lexical = Math.max(
    diceSimilarity(query, candidate),
    tokenSimilarity(query, candidate)
  )
  if (lexical < 0.34) return 0
  return Math.round(lexical * 5_000)
}

export function rankRankingSubjectSuggestions(
  rawQuery: string,
  options: RankingSubjectOption[],
  limit = RANKING_SUBJECT_SUGGESTION_LIMIT
): RankingSubjectSuggestion[] {
  const query = normalizeRankingSubjectLookup(rawQuery)
  const boundedLimit = Math.max(1, Math.min(limit, RANKING_SUBJECT_SUGGESTION_LIMIT))

  if (!query) {
    return [...options]
      .sort((left, right) => {
        if (left.usage_count !== right.usage_count) return right.usage_count - left.usage_count
        return left.subject_key.localeCompare(right.subject_key)
      })
      .slice(0, boundedLimit)
      .map(option => ({
        ...option,
        score: 0,
        matched_by: 'canonical' as const,
        matched_key: option.subject_key,
      }))
  }

  const suggestions: RankingSubjectSuggestion[] = []
  for (const option of options) {
    let bestScore = scoreKey(query, option.subject_key)
    let matchedBy: 'canonical' | 'alias' = 'canonical'
    let matchedKey = option.subject_key

    for (const alias of option.aliases) {
      const aliasScore = scoreKey(query, alias)
      if (aliasScore > bestScore) {
        bestScore = aliasScore
        matchedBy = 'alias'
        matchedKey = alias
      }
    }

    if (bestScore <= 0) continue
    suggestions.push({
      ...option,
      score: bestScore,
      matched_by: matchedBy,
      matched_key: matchedKey,
    })
  }

  return suggestions
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score
      if (left.usage_count !== right.usage_count) return right.usage_count - left.usage_count
      return left.subject_key.localeCompare(right.subject_key)
    })
    .slice(0, boundedLimit)
}
