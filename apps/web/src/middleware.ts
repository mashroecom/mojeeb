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
  '/conversations',
  '/customers',
  '/knowledge-base',
  '/leads',
  '/message-templates',
  '/onboarding',
  '/settings',
  '/team',
  '/webhooks',
];

// Pages that need auth but are allowed without completing onboarding
const ONBOARDING_ALLOWED = ['/onboarding'];

function stripLocale(pathname: string): string {
  return pathname.replace(/^\/(ar|en)/, '');
}

function isProtectedPath(pathname: string): boolean {
  const stripped = stripLocale(pathname);
  return PROTECTED_PATHS.some(
    (p) => stripped === p || stripped.startsWith(p + '/'),
  );
}

function isOnboardingAllowed(pathname: string): boolean {
  const stripped = stripLocale(pathname);
  return ONBOARDING_ALLOWED.some(
    (p) => stripped === p || stripped.startsWith(p + '/'),
  );
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname)) {
    const token = request.cookies.get('accessToken')?.value;
    if (!token) {
      const locale =
        pathname.match(/^\/(ar|en)/)?.[1] || routing.defaultLocale;
      const loginUrl = new URL(`/${locale}/login`, request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Check onboarding cookie — redirect non-onboarded users to /onboarding
    const onboardingDone = request.cookies.get('onboardingCompleted')?.value;
    if (onboardingDone === '0' && !isOnboardingAllowed(pathname)) {
      const locale =
        pathname.match(/^\/(ar|en)/)?.[1] || routing.defaultLocale;
      const onboardingUrl = new URL(`/${locale}/onboarding`, request.url);
      return NextResponse.redirect(onboardingUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/', '/(ar|en)/:path*', '/((?!api/|_next|_vercel|.*\\..*).*)'],
};
