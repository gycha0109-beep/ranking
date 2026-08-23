import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PRODUCTION_E2E_HEADER = 'x-rankingwiki-production-e2e'
const PRODUCTION_E2E_MARKER = 'readonly-v1'

function requiredCapability(pathname: string) {
  if (pathname === '/admin' || pathname === '/admin/') return 'admin_console_access'
  if (pathname.startsWith('/admin/comments')) return 'moderation_review'
  if (pathname.startsWith('/admin/comment-reports')) return 'report_review'
  if (pathname.startsWith('/admin/user-sanctions')) return 'sanction_view'
  if (pathname.startsWith('/admin/access-control')) return 'role_manage'
  if (pathname.startsWith('/admin/audit')) return 'audit_view'
  if (pathname.startsWith('/admin/maintenance')) return 'audit_view'
  return 'content_manage'
}

function applyRobotsHeader(response: NextResponse, request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const privateSurface = pathname.startsWith('/admin') || pathname.startsWith('/me') || pathname === '/login'
  const searchSurface = pathname === '/search'
  const categoryVariant = pathname.startsWith('/categories/') && ['sort', 'cursor', 'facet'].some((key) => request.nextUrl.searchParams.has(key))

  if (privateSurface) response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  else if (searchSurface || categoryVariant) response.headers.set('X-Robots-Tag', 'noindex, follow')
  return response
}

function suppressReadOnlyProductionE2ETelemetry(request: NextRequest) {
  if (request.method !== 'POST' || request.nextUrl.pathname !== '/api/measure-1') return null
  if (request.headers.get(PRODUCTION_E2E_HEADER) !== PRODUCTION_E2E_MARKER) return null

  const response = NextResponse.json({ inserted: false, suppressed: true }, { status: 200 })
  response.headers.set('X-RankingWiki-Telemetry', 'suppressed-production-e2e')
  return response
}

export async function middleware(request: NextRequest) {
  const suppressedTelemetry = suppressReadOnlyProductionE2ETelemetry(request)
  if (suppressedTelemetry) return suppressedTelemetry

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      const response = NextResponse.redirect(url)
      response.headers.set('X-Robots-Tag', 'noindex, nofollow')
      return response
    }

    const { data: allowed, error } = await supabase.rpc('has_admin_capability', {
      p_capability: requiredCapability(pathname),
    })

    if (error || allowed !== true) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('error', 'not_authorized')
      const response = NextResponse.redirect(url)
      response.headers.set('X-Robots-Tag', 'noindex, nofollow')
      return response
    }
  }

  return applyRobotsHeader(supabaseResponse, request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
