import type { Rf1BehaviorEvent, Rf1Feature } from './rf1-core'

export type Rf1ProfileEventRow = {
  event_id: string
  event_type: 'SAVE' | 'UNSAVE'
  occurred_at: string
  ranking_id: string | null
  item_id: string | null
  category_id: string | null
  subcategory_id: string | null
  ranking_type: string | null
  ranking_item_ids: string[] | null
}

function requiredTrimmed(value: unknown, label: string) {
  if (typeof value !== 'string' || !value || value.trim() !== value) {
    throw new Error(`${label} must be a non-empty trimmed string`)
  }
  return value
}

function optionalTrimmed(value: unknown, label: string) {
  if (value === null || value === undefined) return null
  return requiredTrimmed(value, label)
}

function dedupeFeatures(features: Rf1Feature[]) {
  const byKey = new Map<string, Rf1Feature>()
  for (const feature of features) {
    const key = `${feature.kind}:${feature.id}`
    if (!byKey.has(key)) byKey.set(key, feature)
  }
  return [...byKey.values()].sort((left, right) => {
    const leftKey = `${left.kind}:${left.id}`
    const rightKey = `${right.kind}:${right.id}`
    return leftKey.localeCompare(rightKey)
  })
}

export function adaptRf1ProfileEventRows(rows: Rf1ProfileEventRow[]): Rf1BehaviorEvent[] {
  const seen = new Set<string>()

  return rows.map((row) => {
    const eventId = requiredTrimmed(row.event_id, 'profile event ID')
    if (seen.has(eventId)) throw new Error(`duplicate RF-1 profile event ID: ${eventId}`)
    seen.add(eventId)

    if (row.event_type !== 'SAVE' && row.event_type !== 'UNSAVE') {
      throw new Error(`unsupported RF-1 profile event type: ${String(row.event_type)}`)
    }
    if (!Number.isFinite(Date.parse(row.occurred_at))) throw new Error(`profile event ${eventId} has an invalid timestamp`)

    const rankingId = optionalTrimmed(row.ranking_id, 'ranking_id')
    const itemId = optionalTrimmed(row.item_id, 'item_id')
    if ((rankingId ? 1 : 0) + (itemId ? 1 : 0) !== 1) {
      throw new Error(`profile event ${eventId} must resolve to exactly one source target`)
    }

    const features: Rf1Feature[] = []
    if (rankingId) {
      const categoryId = requiredTrimmed(row.category_id, `profile event ${eventId} category_id`)
      const rankingType = requiredTrimmed(row.ranking_type, `profile event ${eventId} ranking_type`)
      features.push({ kind: 'category', id: categoryId })
      features.push({ kind: 'rankingType', id: rankingType })

      const subcategoryId = optionalTrimmed(row.subcategory_id, `profile event ${eventId} subcategory_id`)
      if (subcategoryId) features.push({ kind: 'subcategory', id: subcategoryId })

      for (const rawItemId of row.ranking_item_ids || []) {
        features.push({ kind: 'item', id: requiredTrimmed(rawItemId, `profile event ${eventId} ranking item ID`) })
      }
    } else if (itemId) {
      features.push({ kind: 'item', id: itemId })
    }

    return {
      eventId,
      eventType: row.event_type,
      occurredAt: new Date(row.occurred_at).toISOString(),
      magnitude: 1,
      features: dedupeFeatures(features),
      recommendationRunId: null,
      exposureId: null,
    }
  })
}
