'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const CONTENT_PATH = /^\/(rankings|items)\/[^/?#]+$/
const RANKING_PATH = /^\/rankings\/[^/?#]+$/

type VisibilityEndReason = 'out_of_view' | 'page_hidden' | 'page_exit' | 'unmount'

type ActiveRelatedObservation = {
  observationId: string
  startedAt: number
  entryIntersectionRatioPpm: number
  targetPath: string
  recommendationExposureId?: string
}

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

function relatedRankingLinks(pathname: string) {
  if (!RANKING_PATH.test(pathname)) return []
  return Array.from(document.querySelectorAll<HTMLAnchorElement>('main a[href^="/rankings/"]'))
    .filter((link) => {
      const targetPath = new URL(link.href, window.location.origin).pathname
      return RANKING_PATH.test(targetPath) && targetPath !== pathname
    })
}

function isDiscoverySource(pathname: string) {
  return pathname === '/'
    || pathname.startsWith('/categories/')
    || pathname.startsWith('/rankings/')
    || pathname.startsWith('/items/')
}

function intersectionRatioPpm(ratio: number) {
  return Math.max(1, Math.min(1_000_000, Math.round(ratio * 1_000_000)))
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
    const anchors = relatedRankingLinks(pathname)
    if (anchors.length === 0) return

    const active = new Map<HTMLAnchorElement, ActiveRelatedObservation>()
    let observer: IntersectionObserver | null = null
    let pageExited = false

    function startObservation(anchor: HTMLAnchorElement, ratio: number) {
      if (document.visibilityState !== 'visible' || active.has(anchor) || ratio <= 0) return

      const targetPath = new URL(anchor.href, window.location.origin).pathname
      const observationId = eventId()
      const entryIntersectionRatioPpm = intersectionRatioPpm(ratio)
      const recommendationExposureId = anchor.dataset.rf1ExposureId
      const state: ActiveRelatedObservation = {
        observationId,
        startedAt: performance.now(),
        entryIntersectionRatioPpm,
        targetPath,
        ...(recommendationExposureId ? { recommendationExposureId } : {}),
      }
      active.set(anchor, state)
      anchor.dataset.measureObservationId = observationId

      postEvent({
        kind: 'related_ranking_impression',
        observationId,
        sourcePath: pathname,
        targetPath,
        entryIntersectionRatioPpm,
        ...(recommendationExposureId ? { recommendationExposureId } : {}),
      })
    }

    function finishObservation(anchor: HTMLAnchorElement, reason: VisibilityEndReason) {
      const state = active.get(anchor)
      if (!state) return
      active.delete(anchor)
      if (anchor.dataset.measureObservationId === state.observationId) {
        delete anchor.dataset.measureObservationId
      }

      postEvent({
        kind: 'related_ranking_visibility',
        observationId: state.observationId,
        sourcePath: pathname,
        targetPath: state.targetPath,
        visibleDurationMs: Math.max(0, Math.round(performance.now() - state.startedAt)),
        entryIntersectionRatioPpm: state.entryIntersectionRatioPpm,
        visibilityEndReason: reason,
        ...(state.recommendationExposureId ? { recommendationExposureId: state.recommendationExposureId } : {}),
      })
    }

    function finishAll(reason: VisibilityEndReason) {
      for (const anchor of [...active.keys()]) finishObservation(anchor, reason)
    }

    function observeAnchors() {
      observer?.disconnect()
      observer = new IntersectionObserver((entries) => {
        if (document.visibilityState !== 'visible') return
        for (const entry of entries) {
          const anchor = entry.target as HTMLAnchorElement
          if (entry.isIntersecting && entry.intersectionRatio > 0) {
            startObservation(anchor, entry.intersectionRatio)
          } else {
            finishObservation(anchor, 'out_of_view')
          }
        }
      }, { threshold: 0 })
      for (const anchor of anchors) observer.observe(anchor)
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        finishAll('page_hidden')
        observer?.disconnect()
      } else {
        observeAnchors()
      }
    }

    function onPageHide() {
      pageExited = true
      finishAll('page_exit')
    }

    observeAnchors()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      if (!pageExited) finishAll('unmount')
      for (const anchor of anchors) delete anchor.dataset.measureObservationId
    }
  }, [pathname])

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
      const observationId = anchor.dataset.measureObservationId
      postEvent({
        kind: 'content_discovery_click',
        sourcePath: pathname,
        targetPath: url.pathname,
        ...(recommendationExposureId ? { recommendationExposureId } : {}),
        ...(observationId ? { observationId } : {}),
      })
    }

    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [pathname, searchParams])

  return null
}
