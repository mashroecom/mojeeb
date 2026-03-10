import robotsParser from 'robots-parser';
import { cache } from '../config/cache';
import { logger } from '../config/logger';
import { BadRequestError } from '../utils/errors';

export class RobotsTxtService {
  private readonly CACHE_TTL = 86400; // 24 hours in seconds
  private readonly USER_AGENT = 'MojeebBot/1.0';

  /**
   * Fetch and parse robots.txt for a given base URL.
   * Results are cached in Redis for 24 hours.
   */
  async fetchAndParse(baseUrl: string): Promise<any> {
    try {
      const url = new URL(baseUrl);
      const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
      const cacheKey = `robots:${url.host}`;

      // Try to get from cache first
      return await cache.getOrSet(cacheKey, this.CACHE_TTL, async () => {
        try {
          const response = await fetch(robotsUrl, {
            headers: { 'User-Agent': this.USER_AGENT },
            signal: AbortSignal.timeout(10000),
          });

          let robotsTxt = '';
          if (response.ok) {
            robotsTxt = await response.text();
          } else if (response.status === 404) {
            // No robots.txt means everything is allowed
            robotsTxt = '';
          } else {
            logger.warn({ robotsUrl, status: response.status }, 'Failed to fetch robots.txt');
            robotsTxt = '';
          }

          // Parse robots.txt using robots-parser
          return robotsParser(robotsUrl, robotsTxt);
        } catch (err) {
          logger.error({ err, robotsUrl }, 'Error fetching robots.txt');
          // On error, return permissive parser (allows everything)
          return robotsParser(robotsUrl, '');
        }
      });
    } catch (err) {
      logger.error({ err, baseUrl }, 'Invalid URL for robots.txt fetch');
      throw new BadRequestError('Invalid URL provided');
    }
  }

  /**
   * Check if a URL is allowed to be crawled by a specific user agent.
   * @param url - The URL to check
   * @param userAgent - The user agent string (defaults to MojeebBot/1.0)
   * @returns true if the URL can be crawled, false otherwise
   */
  async isAllowed(url: string, userAgent: string = this.USER_AGENT): Promise<boolean> {
    try {
      const parsedUrl = new URL(url);
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

      const robots = await this.fetchAndParse(baseUrl);
      const isAllowed = robots.isAllowed(url, userAgent);

      if (!isAllowed) {
        logger.info({ url, userAgent }, 'URL blocked by robots.txt');
      }

      return isAllowed ?? true;
    } catch (err) {
      logger.error({ err, url }, 'Error checking robots.txt permissions');
      // On error, be conservative and allow the request
      return true;
    }
  }

  /**
   * Get the crawl delay (in seconds) specified in robots.txt for a given user agent.
   * @param baseUrl - The base URL of the site
   * @param userAgent - The user agent string (defaults to MojeebBot/1.0)
   * @returns crawl delay in seconds, or 0 if not specified
   */
  async getCrawlDelay(baseUrl: string, userAgent: string = this.USER_AGENT): Promise<number> {
    try {
      const robots = await this.fetchAndParse(baseUrl);
      const delay = robots.getCrawlDelay(userAgent);
      return delay ?? 0;
    } catch (err) {
      logger.error({ err, baseUrl }, 'Error getting crawl delay from robots.txt');
      return 0;
    }
  }

  /**
   * Get the sitemap URLs specified in robots.txt.
   * @param baseUrl - The base URL of the site
   * @returns array of sitemap URLs
   */
  async getSitemaps(baseUrl: string): Promise<string[]> {
    try {
      const robots = await this.fetchAndParse(baseUrl);
      const sitemaps = robots.getSitemaps();
      return sitemaps ?? [];
    } catch (err) {
      logger.error({ err, baseUrl }, 'Error getting sitemaps from robots.txt');
      return [];
    }
  }
}

export const robotsTxtService = new RobotsTxtService();
