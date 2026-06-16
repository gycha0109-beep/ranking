import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 사용자 정보 조회
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // 어드민 경로 보호
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    // 개발 환경 한정 ADMIN_BOOTSTRAP_EMAIL 자동 어드민 승격 처리
    // 미들웨어 또는 API 등에서 임시 승격 처리
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.ADMIN_BOOTSTRAP_EMAIL &&
      user.email === process.env.ADMIN_BOOTSTRAP_EMAIL
    ) {
      // user_roles 테이블에 admin 권한이 없는 경우 삽입 시도
      // (Supabase의 Service Role 권한 등이 필요할 수 있으나, anonymous RLS 정책이 막힐 수 있음)
      // 따라서 bootstrap 로직은 로그인 API 또는 Server Action 단계에서 처리하는 것이 훨씬 안전함.
      // 여기서는 권한만 한 번 더 검증하고, 없을 경우 로그인 단에서 승격이 일어날 것이므로 DB 조회를 계속 진행함.
    }

    // user_roles에서 어드민 권한 조회
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'not_authorized')
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
