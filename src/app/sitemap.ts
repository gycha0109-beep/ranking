import type { MetadataRoute } from 'next'
import { absoluteUrl, getPublicSitemapRows } from '@/lib/seo'

export const dynamic = 'force-dynamic'

function lastModified(row: any) {
  const value = row.updated_at || row.published_at || row.created_at
  return value ? new Date(value) : undefined
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await getPublicSitemapRows()
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/categories'), changeFrequency: 'weekly', priority: 0.8 },
  ]

  for (const category of rows.categories) {
    entries.push({
      url: absoluteUrl(`/categories/${category.slug}`),
      lastModified: lastModified(category),
      changeFrequency: 'weekly',
      priority: 0.8,
    })
  }

  for (const subcategory of rows.subcategories) {
    entries.push({
      url: absoluteUrl(`/categories/${subcategory.category.slug}/${subcategory.slug}`),
      lastModified: lastModified(subcategory),
      changeFrequency: 'weekly',
      priority: 0.7,
    })
  }

  for (const ranking of rows.rankings) {
    entries.push({
      url: absoluteUrl(`/rankings/${ranking.slug}`),
      lastModified: lastModified(ranking),
      changeFrequency: 'weekly',
      priority: 0.9,
    })
  }

  for (const item of rows.items) {
    entries.push({
      url: absoluteUrl(`/items/${item.slug}`),
      lastModified: lastModified(item),
      changeFrequency: 'monthly',
      priority: 0.6,
    })
  }

  return entries
}
