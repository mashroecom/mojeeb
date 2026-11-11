import { describe, expect, it } from 'vitest';
import {
  MAX_URL_PATTERNS,
  matchesUrlPattern,
  matchesUrlPatterns,
  parseUrlPatterns,
  serializeUrlPatterns,
} from './urlPatterns';

describe('parseUrlPatterns', () => {
  it('returns an empty list for missing input', () => {
    expect(parseUrlPatterns(undefined)).toEqual([]);
    expect(parseUrlPatterns(null)).toEqual([]);
    expect(parseUrlPatterns('')).toEqual([]);
    expect(parseUrlPatterns([])).toEqual([]);
  });

  it('splits a comma-separated string and trims each filter', () => {
    expect(parseUrlPatterns(' /docs/ , /help/,, /faq/ ')).toEqual(['/docs/', '/help/', '/faq/']);
  });

  it('accepts an array, including items that still contain commas', () => {
    expect(parseUrlPatterns(['/docs/', ' /help/, /faq/ ', ''])).toEqual([
      '/docs/',
      '/help/',
      '/faq/',
    ]);
  });

  it('drops duplicates case-insensitively, keeping the first spelling', () => {
    expect(parseUrlPatterns('/Docs/, /docs/, /DOCS/')).toEqual(['/Docs/']);
  });

  it('drops over-long filters and caps the list', () => {
    expect(parseUrlPatterns(['/ok/', 'x'.repeat(201)])).toEqual(['/ok/']);
    const many = Array.from({ length: 50 }, (_, i) => `/p${i}/`);
    expect(parseUrlPatterns(many)).toHaveLength(MAX_URL_PATTERNS);
  });

  it('round-trips through the storage form', () => {
    const patterns = ['/docs/', '/help/*.html'];
    expect(parseUrlPatterns(serializeUrlPatterns(patterns))).toEqual(patterns);
    expect(serializeUrlPatterns([])).toBeNull();
  });
});

describe('matchesUrlPattern', () => {
  it('matches a filter anywhere in the path', () => {
    expect(matchesUrlPattern('https://shop.example/docs/setup', '/docs/')).toBe(true);
    expect(matchesUrlPattern('https://shop.example/en/docs/setup', '/docs/')).toBe(true);
    expect(matchesUrlPattern('https://shop.example/blog/post', '/docs/')).toBe(false);
  });

  it('does not match the host name for a path filter', () => {
    expect(matchesUrlPattern('https://docs.example/pricing', 'docs')).toBe(false);
    expect(matchesUrlPattern('https://shop.example/docs', 'docs')).toBe(true);
  });

  it('looks at the query string too', () => {
    expect(matchesUrlPattern('https://shop.example/page?category=faq', 'category=faq')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesUrlPattern('https://shop.example/Docs/Setup', '/docs/')).toBe(true);
  });

  it('treats regex metacharacters literally', () => {
    expect(matchesUrlPattern('https://shop.example/returns.html', 'returns.html')).toBe(true);
    expect(matchesUrlPattern('https://shop.example/returnsXhtml', 'returns.html')).toBe(false);
    expect(matchesUrlPattern('https://shop.example/a', '(a+)+$')).toBe(false);
    expect(matchesUrlPattern('https://shop.example/a', '[')).toBe(false);
  });

  it('supports * as a wildcard', () => {
    expect(matchesUrlPattern('https://shop.example/help/returns.html', '/help/*.html')).toBe(true);
    expect(matchesUrlPattern('https://shop.example/help/returns.pdf', '/help/*.html')).toBe(false);
    expect(matchesUrlPattern('https://shop.example/x.html/help/', '/help/*.html')).toBe(false);
    expect(matchesUrlPattern('https://shop.example/anything', '*')).toBe(true);
  });

  it('compares a full-URL filter against the whole URL as a prefix', () => {
    const filter = 'https://shop.example/docs';
    expect(matchesUrlPattern('https://shop.example/docs/setup', filter)).toBe(true);
    expect(
      matchesUrlPattern('https://shop.example/blog?next=https://shop.example/docs', filter),
    ).toBe(false);
    expect(matchesUrlPattern('https://other.example/docs/setup', filter)).toBe(false);
    expect(
      matchesUrlPattern('https://shop.example/en/docs/x', 'https://shop.example/*/docs/'),
    ).toBe(true);
  });

  it('rejects something that is not a URL', () => {
    expect(matchesUrlPattern('not a url', '/docs/')).toBe(false);
  });
});

describe('matchesUrlPatterns', () => {
  it('allows everything when there are no filters', () => {
    expect(matchesUrlPatterns('https://shop.example/anything', [])).toBe(true);
    expect(matchesUrlPatterns('https://shop.example/anything', undefined)).toBe(true);
  });

  it('passes when any filter matches', () => {
    const filters = ['/docs/', '/faq/'];
    expect(matchesUrlPatterns('https://shop.example/faq/shipping', filters)).toBe(true);
    expect(matchesUrlPatterns('https://shop.example/blog/post', filters)).toBe(false);
  });

  it('the root page does not match a path filter (the crawler always crawls the start page itself)', () => {
    expect(matchesUrlPatterns('https://shop.example', ['/docs/'])).toBe(false);
  });
});
