/**
 * Cookie helpers for server-side auth checks.
 * The accessToken cookie is set alongside localStorage so that
 * Next.js middleware can gate dashboard routes before they render.
 */

const COOKIE_NAME = 'accessToken';
const MAX_AGE = 60 * 60 * 24; // 1 day (aligned closer to JWT access expiry window)

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

export function clearAuthCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}
