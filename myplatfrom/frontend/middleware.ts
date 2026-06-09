import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

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

    // KDS route — chef and manager only
    if (pathname.startsWith('/kds/')) {
      if (!['chef', 'manager'].includes(role)) return NextResponse.redirect(new URL('/login', req.url))
      return NextResponse.next()
    }

    // Staff dashboard routes
    if (pathname.startsWith('/dashboard/')) {
      if (role === 'super_admin') return NextResponse.redirect(new URL('/admin', req.url))

      if (pathname.includes('/kitchen') && role !== 'chef' && role !== 'manager') {
        return NextResponse.redirect(new URL('/login', req.url))
      }
      if (pathname.includes('/orders') && role !== 'employee' && role !== 'manager') {
        return NextResponse.redirect(new URL('/login', req.url))
      }
      if ((pathname.includes('/employees') || pathname.includes('/reports') || pathname.includes('/promotions') || pathname.includes('/inventory')) && role !== 'manager') {
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
  matcher: ['/dashboard/:path*', '/admin/:path*', '/kds/:path*', '/admin', '/login', '/register'],
}
