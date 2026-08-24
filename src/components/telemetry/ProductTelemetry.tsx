'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const CONTENT_PATH = /^\/(rankings|items)\/[^/?#]+$/

function eventId() {
  return crypto.randomUUID()
}

function postEvent(payload: Record<string, unknown>) {
  void fetch('/api/measure-1', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...payload, clientEventId: eventId() }),
  }).catch(() => undefined)
}

function resultLinks() {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>(
    'main a[href^="/rankings/"], main a[href^="/items/"]',
  )).filter((link) => CONTENT_PATH.test(new URL(link.href, window.location.origin).pathname))
}

function isDiscoverySource(pathname: string) {
  return pathname === '/'
    || pathname.startsWith('/categories/')
    || pathname.startsWith('/rankings/')
    || pathname.startsWith('/items/')
}

export default function ProductTelemetry() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastViewPath = useRef<string | null>(null)
  const lastSearchKey = useRef<string | null>(null)
  const currentSearchId = useRef<string | null>(null)

  useEffect(() => {
    if (!CONTENT_PATH.test(pathname) || lastViewPath.current === pathname) return
    lastViewPath.current = pathname
    postEvent({ kind: 'content_view', targetPath: pathname })
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/search') {
      lastSearchKey.current = null
      currentSearchId.current = null
      return
    }

    const query = searchParams.get('q') || ''
    const normalized = query.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
    if (normalized.length < 2 || normalized.length > 120) return

    const searchKey = `${pathname}?${searchParams.toString()}`
    if (lastSearchKey.current === searchKey) return
    lastSearchKey.current = searchKey

    const searchId = eventId()
    currentSearchId.current = searchId
    const frame = window.requestAnimationFrame(() => {
      postEvent({
        kind: 'search',
        searchId,
        query: normalized,
        resultCount: resultLinks().length,
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [pathname, searchParams])

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return

      let url: URL
      try {
        url = new URL(anchor.href, window.location.origin)
      } catch {
        return
      }
      if (url.origin !== window.location.origin || !CONTENT_PATH.test(url.pathname) || url.pathname === pathname) return

      if (pathname === '/search') {
        const query = searchParams.get('q') || ''
        const normalized = query.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
        if (normalized.length < 2 || normalized.length > 120) return

        let searchId = currentSearchId.current
        if (!searchId) {
          searchId = eventId()
          currentSearchId.current = searchId
          postEvent({ kind: 'search', searchId, query: normalized, resultCount: resultLinks().length })
        }

        const position = resultLinks().indexOf(anchor) + 1
        if (position < 1 || position > 100) return
        postEvent({
          kind: 'search_result_click',
          searchId,
          query: normalized,
          sourcePath: '/search',
          targetPath: url.pathname,
          selectedPosition: position,
        })
        return
      }

      if (!isDiscoverySource(pathname)) return
      const recommendationExposureId = anchor.dataset.rf1ExposureId
      postEvent({
        kind: 'content_discovery_click',
        sourcePath: pathname,
        targetPath: url.pathname,
        ...(recommendationExposureId ? { recommendationExposureId } : {}),
      })
    }

    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [pathname, searchParams])

  return null
}
