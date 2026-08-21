const SEOUL_TIME_ZONE = 'Asia/Seoul'

export function formatKoreanDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('ko-KR', { timeZone: SEOUL_TIME_ZONE })
}

export function formatRankingBasis(
  scope: Record<string, unknown> | null | undefined,
  fallback: string,
) {
  const period = typeof scope?.period === 'string' ? scope.period.trim() : ''
  if (!period) return formatKoreanDate(fallback)

  const isoDate = period.match(/\d{4}-\d{2}-\d{2}/)?.[0]
  return isoDate ? formatKoreanDate(isoDate) : period
}
