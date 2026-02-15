import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const PROTECTED_PATHS = [
  '/dashboard',
  '/agents',
  '/analytics',
  '/api-keys',
  '/billing',
  '/channels',
  '/conversations',
  '/knowledge-base',
  '/leads',
  '/message-templates',
  '/onboarding',
  '/settings',
  '/team',
  '/webhooks',
];

function isProtectedPath(pathname: string): boolean {
  // Strip locale prefix (/ar or /en)
  const stripped = pathname.replace(/^\/(ar|en)/, '');
  return PROTECTED_PATHS.some(
    (p) => stripped === p || stripped.startsWith(p + '/'),
  );
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect unauthenticated users away from dashboard routes
  if (isProtectedPath(pathname)) {
    const token = request.cookies.get('accessToken')?.value;
    if (!token) {
      const locale =
        pathname.match(/^\/(ar|en)/)?.[1] || routing.defaultLocale;
      const loginUrl = new URL(`/${locale}/login`, request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/', '/(ar|en)/:path*', '/((?!api/|_next|_vercel|.*\\..*).*)'],
};
