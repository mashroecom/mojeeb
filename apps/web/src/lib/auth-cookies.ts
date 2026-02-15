/**
 * Cookie helpers for server-side auth checks.
 * The accessToken cookie is set alongside localStorage so that
 * Next.js middleware can gate dashboard routes before they render.
 */

const COOKIE_NAME = 'accessToken';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function setAuthCookie(token: string) {
  document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

export function clearAuthCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}
