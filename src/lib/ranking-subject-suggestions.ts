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

const TOKEN_SEPARATOR_PATTERN = /[._/-]+/g
const TOKEN_BOUNDARY_CHARS = new Set(['.', '_', '/', '-'])
const FUZZY_MIN_DICE = 0.5
const FUZZY_MIN_TOKEN_SIMILARITY = 0.5

export function normalizeRankingSubjectLookup(value: string | null | undefined) {
  return (value || '').normalize('NFKC').trim().toLowerCase()
}

function tokenList(value: string) {
  return value.split(TOKEN_SEPARATOR_PATTERN).filter(Boolean)
}

function tokens(value: string) {
  return new Set(tokenList(value))
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

function isBoundaryCharacter(value: string | undefined) {
  return Boolean(value && TOKEN_BOUNDARY_CHARS.has(value))
}

function hasTokenBoundaryPrefix(prefix: string, value: string) {
  if (!value.startsWith(prefix)) return false
  return value.length === prefix.length || isBoundaryCharacter(value[prefix.length])
}

function hasTokenBoundarySubstring(needle: string, haystack: string) {
  let fromIndex = 0
  while (fromIndex <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, fromIndex)
    if (index < 0) return false

    const before = index === 0 ? undefined : haystack[index - 1]
    const afterIndex = index + needle.length
    const after = afterIndex >= haystack.length ? undefined : haystack[afterIndex]
    const beforeBoundary = index === 0 || isBoundaryCharacter(before)
    const afterBoundary = afterIndex === haystack.length || isBoundaryCharacter(after)

    if (beforeBoundary && afterBoundary) return true
    fromIndex = index + 1
  }
  return false
}

function fuzzyEligible(query: string, candidate: string) {
  const queryTokens = tokenList(query)
  const candidateTokens = tokenList(candidate)

  // Fuzzy matching is only a typo/reordering safety net. Different token counts usually
  // indicate that the author introduced or removed a semantic coordinate, so abstain.
  if (queryTokens.length === 0 || queryTokens.length !== candidateTokens.length) return false

  // Shared prefixes such as smartphone-* or gaming-* are not enough. Requiring the
  // terminal concept token to agree avoids recommending camera for battery, RPG for racing, etc.
  if (queryTokens.at(-1) !== candidateTokens.at(-1)) return false

  const tokenScore = tokenSimilarity(query, candidate)
  const diceScore = diceSimilarity(query, candidate)
  return tokenScore >= FUZZY_MIN_TOKEN_SIMILARITY && diceScore >= FUZZY_MIN_DICE
}

function scoreKey(query: string, candidate: string) {
  if (!query || !candidate) return 0
  if (query === candidate) return 10_000

  const lengthGap = Math.abs(query.length - candidate.length)
  if (hasTokenBoundaryPrefix(query, candidate) || hasTokenBoundaryPrefix(candidate, query)) {
    return 8_000 - Math.min(lengthGap, 500)
  }
  if (hasTokenBoundarySubstring(query, candidate) || hasTokenBoundarySubstring(candidate, query)) {
    return 6_500 - Math.min(lengthGap, 500)
  }

  if (!fuzzyEligible(query, candidate)) return 0

  const lexical = Math.max(
    diceSimilarity(query, candidate),
    tokenSimilarity(query, candidate)
  )
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
