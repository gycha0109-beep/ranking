export const SEMANTIC_PROJECTION_JSON_MAX_CHARS = 8000

const SEMANTIC_KEY_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,127}$/

export type RankingSemanticProjectionFormInput = {
  subject_key: string
  intent_key?: string | null
  method_key?: string | null
  coordinates_json?: string | null
  version_coordinates_json?: string | null
}

export type NormalizedRankingSemanticProjectionInput = {
  subject_key: string
  intent_key: string | null
  method_key: string | null
  coordinates: Record<string, unknown>
  version_coordinates: Record<string, unknown>
}

type ParseResult =
  | { ok: true; value: NormalizedRankingSemanticProjectionInput }
  | { ok: false; error: string }

export function normalizeRankingSemanticKey(value: string | null | undefined) {
  return (value || '').normalize('NFKC').trim().toLowerCase()
}

export function isRankingSemanticKey(value: string | null | undefined) {
  return SEMANTIC_KEY_PATTERN.test(normalizeRankingSemanticKey(value))
}

function normalizeSemanticKey(value: string | null | undefined, label: string, required: boolean) {
  const normalized = normalizeRankingSemanticKey(value)

  if (!normalized) {
    if (required) return { ok: false as const, error: `${label} 값은 필수입니다.` }
    return { ok: true as const, value: null }
  }

  if (!SEMANTIC_KEY_PATTERN.test(normalized)) {
    return {
      ok: false as const,
      error: `${label} 값은 영문 소문자, 숫자, 점(.), 밑줄(_), 하이픈(-), 슬래시(/)만 사용할 수 있습니다.`,
    }
  }

  return { ok: true as const, value: normalized }
}

function parseJsonObject(raw: string | null | undefined, label: string) {
  const text = (raw || '').trim() || '{}'

  if (text.length > SEMANTIC_PROJECTION_JSON_MAX_CHARS) {
    return {
      ok: false as const,
      error: `${label} JSON은 ${SEMANTIC_PROJECTION_JSON_MAX_CHARS.toLocaleString()}자 이하여야 합니다.`,
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false as const, error: `${label} 값이 올바른 JSON이 아닙니다.` }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false as const, error: `${label} 값은 JSON object여야 합니다.` }
  }

  return { ok: true as const, value: parsed as Record<string, unknown> }
}

export function parseRankingSemanticProjectionForm(
  input: RankingSemanticProjectionFormInput
): ParseResult {
  const subject = normalizeSemanticKey(input.subject_key, 'Subject key', true)
  if (!subject.ok) return subject

  const intent = normalizeSemanticKey(input.intent_key, 'Intent key', false)
  if (!intent.ok) return intent

  const method = normalizeSemanticKey(input.method_key, 'Method key', false)
  if (!method.ok) return method

  const coordinates = parseJsonObject(input.coordinates_json, 'Coordinates')
  if (!coordinates.ok) return coordinates

  const versionCoordinates = parseJsonObject(input.version_coordinates_json, 'Version coordinates')
  if (!versionCoordinates.ok) return versionCoordinates

  return {
    ok: true,
    value: {
      subject_key: subject.value as string,
      intent_key: intent.value,
      method_key: method.value,
      coordinates: coordinates.value,
      version_coordinates: versionCoordinates.value,
    },
  }
}
