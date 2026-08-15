import type { MetadataRoute } from 'next'
import { absoluteUrl, getSiteOrigin } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/me', '/login'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: getSiteOrigin(),
  }
}
