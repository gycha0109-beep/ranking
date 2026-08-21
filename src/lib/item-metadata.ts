export type PublicItemFact = {
  key: string
  label: string
  value: string
}

const MAX_FACTS = 8
const MAX_VALUE_LENGTH = 120
const HIDDEN_KEY_PATTERN = /(^_|internal|secret|token|password|moderation|audit|actor|user.?id|email|phone|ip|referrer|session|cookie)/i
const URL_VALUE_PATTERN = /^https?:\/\//i

const GENERIC_TOKEN_LABELS: Record<string, string> = {
  airport: '공항',
  brand: '브랜드',
  category: '분류',
  city: '도시',
  code: '코드',
  country: '국가',
  creator: '제작자',
  date: '날짜',
  gender: '성별',
  genre: '장르',
  label: '표기명',
  language: '언어',
  level: '단계',
  name: '이름',
  platform: '플랫폼',
  region: '지역',
  series: '시리즈',
  supercomputer: '슈퍼컴퓨터',
  title: '제목',
  type: '유형',
  year: '연도',
}

function splitMachineKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function formatMachineToken(token: string, nextToken?: string) {
  const lower = token.toLowerCase()
  if (GENERIC_TOKEN_LABELS[lower]) return GENERIC_TOKEN_LABELS[lower]
  if (/^[a-z]{2,5}\d*$/i.test(token) && (nextToken === 'code' || nextToken === 'label' || /\d/.test(token))) {
    return token.toUpperCase()
  }
  return token.length > 0 ? `${token.charAt(0).toUpperCase()}${token.slice(1)}` : token
}

export function formatItemMachineLabel(key: string) {
  const tokens = splitMachineKey(key)
  if (tokens.length === 0) return key

  return tokens
    .map((token, index) => formatMachineToken(token, tokens[index + 1]?.toLowerCase()))
    .join(' ')
}

function formatPrimitiveValue(value: unknown): string | null {
  if (typeof value === 'boolean') return value ? '예' : '아니요'
  if (typeof value === 'number' && Number.isFinite(value)) return new Intl.NumberFormat('ko-KR').format(value)
  if (typeof value !== 'string') return null

  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized || URL_VALUE_PATTERN.test(normalized)) return null
  if (normalized.length <= MAX_VALUE_LENGTH) return normalized
  return `${normalized.slice(0, MAX_VALUE_LENGTH - 1).trimEnd()}…`
}

function formatMetadataValue(value: unknown): string | null {
  const primitive = formatPrimitiveValue(value)
  if (primitive !== null) return primitive
  if (!Array.isArray(value)) return null

  const values = value
    .slice(0, 6)
    .map((entry) => formatPrimitiveValue(entry))
    .filter((entry): entry is string => Boolean(entry))

  return values.length > 0 ? values.join(' · ') : null
}

export function buildPublicItemFacts(metadata: unknown): PublicItemFact[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []

  return Object.entries(metadata as Record<string, unknown>)
    .filter(([key]) => key.length > 0 && !HIDDEN_KEY_PATTERN.test(key))
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([key, value]) => ({ key, label: formatItemMachineLabel(key), value: formatMetadataValue(value) }))
    .filter((fact): fact is PublicItemFact => Boolean(fact.value))
    .slice(0, MAX_FACTS)
}
