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
const FUZZY_MIN_POSITIONAL_TOKEN_DICE = 0.6
const SINGLE_EDIT_TYPO_MIN_TOKEN_LENGTH = 4

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

function isSingleEditTypo(left: string, right: string) {
  if (left === right) return true
  if (Math.min(left.length, right.length) < SINGLE_EDIT_TYPO_MIN_TOKEN_LENGTH) return false
  if (Math.abs(left.length - right.length) > 1) return false

  if (left.length === right.length) {
    let mismatches = 0
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) mismatches += 1
      if (mismatches > 1) return false
    }
    return mismatches === 1
  }

  const shorter = left.length < right.length ? left : right
  const longer = left.length < right.length ? right : left
  let shortIndex = 0
  let longIndex = 0
  let edits = 0

  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1
      longIndex += 1
      continue
    }

    edits += 1
    if (edits > 1) return false
    longIndex += 1
  }

  if (longIndex < longer.length) edits += 1
  return edits === 1
}

function isExactTokenRotation(left: string, right: string) {
  const leftTokens = tokenList(left)
  const rightTokens = tokenList(right)
  if (leftTokens.length < 2 || leftTokens.length !== rightTokens.length) return false
  if (leftTokens.every((token, index) => token === rightTokens[index])) return false

  for (let offset = 1; offset < leftTokens.length; offset += 1) {
    let matches = true
    for (let index = 0; index < leftTokens.length; index += 1) {
      if (leftTokens[index] !== rightTokens[(index + offset) % rightTokens.length]) {
        matches = false
        break
      }
    }
    if (matches) return true
  }

  return false
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

  // Fuzzy matching remains a typo safety net. Different token counts usually indicate
  // that the author introduced or removed a semantic coordinate, so abstain.
  if (queryTokens.length === 0 || queryTokens.length !== candidateTokens.length) return false

  // The terminal concept may differ only by a single-character typo. This recovers
  // quality/quaity and sales/saes without reopening battery/camera-style semantic drift.
  const queryTerminal = queryTokens.at(-1) || ''
  const candidateTerminal = candidateTokens.at(-1) || ''
  if (queryTerminal !== candidateTerminal && !isSingleEditTypo(queryTerminal, candidateTerminal)) {
    return false
  }

  // A same-shape candidate is accepted only when every changed token looks like a typo,
  // not a different semantic entity. county/country can pass; intangible/world cannot.
  for (let index = 0; index < queryTokens.length; index += 1) {
    if (queryTokens[index] === candidateTokens[index]) continue
    if (
      !isSingleEditTypo(queryTokens[index], candidateTokens[index]) &&
      diceSimilarity(queryTokens[index], candidateTokens[index]) < FUZZY_MIN_POSITIONAL_TOKEN_DICE
    ) {
      return false
    }
  }

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
  if (isExactTokenRotation(query, candidate)) {
    return 7_200
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
