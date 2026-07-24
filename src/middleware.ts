import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function requiredCapability(pathname: string) {
  if (pathname === '/admin' || pathname === '/admin/') return 'admin_console_access'
  if (pathname.startsWith('/admin/comments')) return 'moderation_review'
  if (pathname.startsWith('/admin/comment-reports')) return 'report_review'
  if (pathname.startsWith('/admin/user-sanctions')) return 'sanction_view'
  if (pathname.startsWith('/admin/access-control')) return 'role_manage'
  if (pathname.startsWith('/admin/audit')) return 'audit_view'
  return 'content_manage'
}

export async function middleware(request: NextRequest) {
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
      return NextResponse.redirect(url)
    }

    const { data: allowed, error } = await supabase.rpc('has_admin_capability', {
      p_capability: requiredCapability(pathname),
    })

    if (error || allowed !== true) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('error', 'not_authorized')
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
