import { type NextRequest, NextResponse } from 'next/server';
import { getSafeRedirectPath } from '@/features/auth/lib/safe-redirect';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authToken = request.cookies.get('auth-token');

  // An admin who already has a session has no reason to see the login form.
  // Doing this here rather than in a client effect means the bounce happens
  // before any HTML is sent, so there's no flash of the login card.
  if (pathname === '/login' && authToken) {
    const target = getSafeRedirectPath(request.nextUrl.searchParams.get('redirect'));
    // A `?redirect=/login` would otherwise bounce straight back here forever.
    return NextResponse.redirect(
      new URL(target.startsWith('/login') ? '/dashboard' : target, request.url)
    );
  }

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/callback', '/api/health'];
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith('/api/')
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  if (!authToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images served from public/, which a logged-out visitor and Next's image
     *   optimizer (it fetches them without cookies) must be able to load
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
};
