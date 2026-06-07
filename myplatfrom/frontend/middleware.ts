import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

const ROLE_ROUTES: Record<string, string[]> = {
  '/dashboard/[slug]': ['manager'],
  '/dashboard/[slug]/kitchen': ['chef'],
  '/dashboard/[slug]/orders': ['employee'],
  '/dashboard/[slug]/menu': ['employee', 'manager'],
  '/dashboard/[slug]/tables': ['employee', 'manager'],
  '/dashboard/[slug]/tables/qr': ['manager'],
  '/dashboard/[slug]/promotions': ['manager'],
  '/dashboard/[slug]/employees': ['manager'],
  '/dashboard/[slug]/reports': ['manager'],
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Public routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/r/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/')
  ) return NextResponse.next()

  // Super admin route
  if (pathname.startsWith('/admin')) {
    const token = req.cookies.get('session')?.value
    if (!token) return NextResponse.redirect(new URL('/login', req.url))
    try {
      const { payload } = await jwtVerify(token, secret) as { payload: any }
      if (payload.role !== 'super_admin') return NextResponse.redirect(new URL('/login', req.url))
      return NextResponse.next()
    } catch { return NextResponse.redirect(new URL('/login', req.url)) }
  }

  const token = req.cookies.get('session')?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  try {
    const { payload } = await jwtVerify(token, secret) as { payload: any }
    const role = payload.role as string

    // Staff dashboard routes
    if (pathname.startsWith('/dashboard/')) {
      const parts = pathname.split('/')
      const slug = parts[2]

      // Slug must match restaurantId — enforce role-based access
      if (pathname.includes('/kitchen') && role !== 'chef' && role !== 'manager') {
        return NextResponse.redirect(new URL('/login', req.url))
      }
      if (pathname.includes('/orders') && role !== 'employee' && role !== 'manager') {
        return NextResponse.redirect(new URL('/login', req.url))
      }
      if ((pathname.includes('/employees') || pathname.includes('/reports') || pathname.includes('/promotions')) && role !== 'manager') {
        return NextResponse.redirect(new URL('/login', req.url))
      }

      const res = NextResponse.next()
      res.headers.set('x-user-id', payload.userId)
      res.headers.set('x-user-role', role)
      res.headers.set('x-restaurant-id', payload.restaurantId ?? '')
      return res
    }

    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/admin', '/login', '/register'],
}
