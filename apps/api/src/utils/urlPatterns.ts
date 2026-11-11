/**
 * URL filters for website crawls ("only crawl pages under /docs/").
 *
 * A filter is plain text, not a regular expression: customers type things like
 * `/docs/` or `/blog/*.html`, and a customer-supplied regex would both surprise
 * them (`.` and `?` are common in URLs) and let them hang the crawler with a
 * pathological expression.
 *
 * - A filter matches when it occurs anywhere in the page's path + query string.
 * - `*` matches any run of characters.
 * - A filter that starts with `http://` or `https://` is compared against the
 *   whole URL instead (prefix match), so a pasted address works too.
 * - Matching is case-insensitive.
 */

export const MAX_URL_PATTERNS = 20;
export const MAX_URL_PATTERN_LENGTH = 200;

/**
 * Normalise filters coming from the API (an array) or from storage / older
 * clients (one comma-separated string) into a clean, de-duplicated list.
 */
export function parseUrlPatterns(input: string | string[] | null | undefined): string[] {
  if (!input) return [];
  const parts = Array.isArray(input) ? input.flatMap((item) => item.split(',')) : input.split(',');

  const seen = new Set<string>();
  const patterns: string[] = [];
  for (const part of parts) {
    const pattern = part.trim();
    if (!pattern || pattern.length > MAX_URL_PATTERN_LENGTH) continue;
    const key = pattern.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    patterns.push(pattern);
    if (patterns.length === MAX_URL_PATTERNS) break;
  }
  return patterns;
}

/** Storage form of a filter list (CrawlConfig.urlPattern): comma-separated, or null when empty. */
export function serializeUrlPatterns(patterns: string[]): string | null {
  return patterns.length > 0 ? patterns.join(', ') : null;
}

function wildcardMatch(haystack: string, pattern: string, anchorStart: boolean): boolean {
  // Match the literal pieces between `*`s left to right; no regex involved.
  const pieces = pattern.split('*');
  let position = 0;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]!;
    if (!piece) continue;
    const found = haystack.indexOf(piece, position);
    if (found === -1) return false;
    if (i === 0 && anchorStart && found !== 0) return false;
    position = found + piece.length;
  }
  return true;
}

/** Does `url` pass a single filter? */
export function matchesUrlPattern(url: string, pattern: string): boolean {
  const needle = pattern.trim().toLowerCase();
  if (!needle) return true;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (/^https?:\/\//.test(needle)) {
    return wildcardMatch(parsed.href.toLowerCase(), needle, true);
  }
  return wildcardMatch(`${parsed.pathname}${parsed.search}`.toLowerCase(), needle, false);
}

/** Does `url` pass at least one of the filters? An empty list allows everything. */
export function matchesUrlPatterns(url: string, patterns: string[] | null | undefined): boolean {
  if (!patterns || patterns.length === 0) return true;
  return patterns.some((pattern) => matchesUrlPattern(url, pattern));
}
