import NextAuth from 'next-auth'
import { authConfig } from './lib/auth.config'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const user = req.auth?.user

  // Public: login page
  if (nextUrl.pathname === '/login') {
    if (isLoggedIn) {
      return Response.redirect(new URL('/orders', nextUrl))
    }
    return undefined
  }

  // Public: invite registration pages (but not /invite management page)
  if (nextUrl.pathname.startsWith('/invite/') && nextUrl.pathname !== '/invite') {
    return undefined
  }

  // Require auth for everything else
  if (!isLoggedIn) {
    return Response.redirect(new URL('/login', nextUrl))
  }

  // First-login users must set password
  if (user?.isFirstLogin && nextUrl.pathname !== '/setup-password') {
    return Response.redirect(new URL('/setup-password', nextUrl))
  }

  // Non-first-login users shouldn't access setup-password
  if (!user?.isFirstLogin && nextUrl.pathname === '/setup-password') {
    return Response.redirect(new URL('/orders', nextUrl))
  }

  // Admin routes require ADMIN role
  if (nextUrl.pathname.startsWith('/admin') && user?.role !== 'ADMIN') {
    return Response.redirect(new URL('/orders', nextUrl))
  }

  return undefined
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
