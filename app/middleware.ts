// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Check if the request is for /client/dashboard
  if (request.nextUrl.pathname.startsWith('/client/dashboard')) {
    // Check for auth token in cookies or headers
    const token = request.cookies.get('__session')?.value
    
    // If no token, redirect to login
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/client/dashboard/:path*'
}