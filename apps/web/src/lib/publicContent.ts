/**
 * Public content cache.
 *
 * The marketing pages load CMS-managed content (landing page, plans, FAQ,
 * testimonials, site settings) on the server and cache it for a few minutes.
 * Every such fetch carries PUBLIC_CONTENT_TAG, and saving any of that content in
 * the admin panel invalidates the tag, so edits are visible on the next page load
 * instead of whenever the cache happens to expire.
 */

export const PUBLIC_CONTENT_TAG = 'public-content';

/** Web route (not an API-server route) that invalidates PUBLIC_CONTENT_TAG. */
export const REVALIDATE_PATH = '/web-api/revalidate';

/** Admin API resources whose changes are visible on the public site. */
const PUBLIC_CONTENT_ADMIN_PATHS =
  /^\/admin\/(landing-page|faq|testimonials|plans|site-settings|legal|system-backup\/import)(\/|\?|$)/;

/** True when a successful admin request changed something the public site shows. */
export function affectsPublicContent(method: string | undefined, url: string | undefined): boolean {
  if (!method || !url) return false;
  if (method.toLowerCase() === 'get') return false;
  return PUBLIC_CONTENT_ADMIN_PATHS.test(url);
}

/**
 * Ask the web server to drop its cached public content. Best effort: if it fails,
 * the content simply refreshes when the cache expires.
 */
export async function revalidatePublicContent(accessToken: string | null): Promise<void> {
  if (!accessToken) return;
  try {
    await fetch(REVALIDATE_PATH, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // ignore — see above
  }
}
