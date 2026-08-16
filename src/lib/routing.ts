export function normalizeRouteSlug(value: string) {
  if (!value.includes('%')) return value

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
