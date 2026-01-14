import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
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
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 사용자 세션 확인
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 대시보드나 모바일 페이지 접근 시 인증 체크
  if (request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/mobile')) {
    if (!user) {
      // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
      return NextResponse.redirect(new URL('/', request.url))
    }

    // 사용자 승인 상태 확인
    const { data: userData } = await supabase
      .from('users')
      .select('is_approved')
      .eq('id', user.id)
      .single()

    if (!userData?.is_approved) {
      // 승인되지 않은 경우 로그아웃 후 로그인 페이지로
      await supabase.auth.signOut()
      const redirectUrl = new URL('/', request.url)
      redirectUrl.searchParams.set('error', 'not_approved')
      return NextResponse.redirect(redirectUrl)
    }
  }

  // 이미 로그인된 경우 루트 페이지 접근 시 대시보드로 리다이렉트
  if (request.nextUrl.pathname === '/' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes - 별도 인증 처리)
     */
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}
