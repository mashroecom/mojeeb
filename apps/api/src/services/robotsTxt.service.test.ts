import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// An in-memory cache that round-trips values through JSON, like the Redis-backed one
const store = new Map<string, string>();
vi.mock('../config/cache', () => ({
  cache: {
    async getOrSet<T>(key: string, _ttl: number, fetchFn: () => Promise<T>): Promise<T> {
      const hit = store.get(key);
      if (hit !== undefined) return JSON.parse(hit) as T;
      const value = await fetchFn();
      store.set(key, JSON.stringify(value));
      return value;
    },
  },
}));

vi.mock('../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const safeFetch = vi.fn();
vi.mock('../utils/safeFetch', () => ({ safeFetch: (...args: unknown[]) => safeFetch(...args) }));

import { robotsTxtService } from './robotsTxt.service';

const ROBOTS = ['User-agent: *', 'Disallow: /private/', 'Crawl-delay: 2', ''].join('\n');

describe('RobotsTxtService', () => {
  beforeEach(() => {
    store.clear();
    safeFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('applies robots.txt rules on a cache hit as well as on the first request', async () => {
    safeFetch.mockResolvedValue(new Response(ROBOTS, { status: 200 }));

    // First call fetches and caches
    expect(await robotsTxtService.isAllowed('https://shop.example/private/orders')).toBe(false);
    // Later calls are served from the cache and must still enforce the rules
    expect(await robotsTxtService.isAllowed('https://shop.example/private/customers')).toBe(false);
    expect(await robotsTxtService.isAllowed('https://shop.example/products')).toBe(true);

    expect(safeFetch).toHaveBeenCalledTimes(1);
    expect(safeFetch.mock.calls[0]![0]).toBe('https://shop.example/robots.txt');
  });

  it('allows everything when the site has no robots.txt', async () => {
    safeFetch.mockResolvedValue(new Response('not found', { status: 404 }));

    expect(await robotsTxtService.isAllowed('https://shop.example/anything')).toBe(true);
    expect(await robotsTxtService.isAllowed('https://shop.example/else')).toBe(true);
  });

  it('allows everything when robots.txt cannot be fetched', async () => {
    safeFetch.mockRejectedValue(new Error('network down'));

    expect(await robotsTxtService.isAllowed('https://shop.example/private/orders')).toBe(true);
  });

  it('caches per host', async () => {
    safeFetch
      .mockResolvedValueOnce(new Response(ROBOTS, { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));

    expect(await robotsTxtService.isAllowed('https://a.example/private/x')).toBe(false);
    expect(await robotsTxtService.isAllowed('https://b.example/private/x')).toBe(true);
    expect(safeFetch).toHaveBeenCalledTimes(2);
  });
});
