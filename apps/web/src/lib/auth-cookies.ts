/**
 * Cookie helpers for server-side auth checks.
 * The accessToken cookie is set alongside localStorage so that
 * Next.js middleware can gate dashboard routes before they render.
 */

const COOKIE_NAME = 'accessToken';
const ONBOARDING_COOKIE = 'onboardingCompleted';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days — keeps user logged in across sessions

export function setAuthCookie(token: string) {
  const isSecure = window.location.protocol === 'https:';
  const flags = [
    `${COOKIE_NAME}=${token}`,
    'path=/',
    `max-age=${MAX_AGE}`,
    'SameSite=Strict',
    ...(isSecure ? ['Secure'] : []),
  ];
  document.cookie = flags.join('; ');
}

export function setOnboardingCookie(completed: boolean) {
  const isSecure = window.location.protocol === 'https:';
  const flags = [
    `${ONBOARDING_COOKIE}=${completed ? '1' : '0'}`,
    'path=/',
    `max-age=${MAX_AGE}`,
    'SameSite=Strict',
    ...(isSecure ? ['Secure'] : []),
  ];
  document.cookie = flags.join('; ');
}

export function clearAuthCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
  document.cookie = `${ONBOARDING_COOKIE}=; path=/; max-age=0`;
}
