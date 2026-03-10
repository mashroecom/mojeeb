import * as cheerio from 'cheerio';
import { logger } from '../config/logger';
import { BadRequestError } from '../utils/errors';
import { robotsTxtService } from './robotsTxt.service';

export interface CrawlConfig {
  maxDepth?: number;
  urlPatterns?: string[];
  respectRobotsTxt?: boolean;
  userAgent?: string;
}

export interface CrawlResult {
  text: string;
  links: string[];
  metadata: {
    title?: string;
    description?: string;
    author?: string;
    keywords?: string;
    language?: string;
    url: string;
  };
}

export class CrawlerService {
  private readonly USER_AGENT = 'MojeebBot/1.0';
  private readonly TIMEOUT_MS = 15000;

  /**
   * Crawl a URL and extract clean text content, links, and metadata.
   * @param url - The URL to crawl
   * @param config - Crawl configuration options
   * @returns Crawl result containing text, links, and metadata
   */
  async crawlUrl(url: string, config: CrawlConfig = {}): Promise<CrawlResult> {
    try {
      // Validate URL
      const parsedUrl = new URL(url);

      // Check robots.txt if enabled
      if (config.respectRobotsTxt !== false) {
        const isAllowed = await robotsTxtService.isAllowed(
          url,
          config.userAgent || this.USER_AGENT
        );
        if (!isAllowed) {
          throw new BadRequestError('URL is disallowed by robots.txt');
        }
      }

      // Fetch the page
      const response = await fetch(url, {
        headers: {
          'User-Agent': config.userAgent || this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
        },
        signal: AbortSignal.timeout(this.TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get content type and check if it's HTML
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw new BadRequestError('URL does not return HTML content');
      }

      // Get the HTML content with proper encoding
      const html = await response.text();

      // Extract text, links, and metadata using cheerio
      const text = this.cleanHtmlContent(html);
      const links = this.extractLinks(html, url);
      const metadata = this.extractMetadata(html, url);

      return { text, links, metadata };
    } catch (err: any) {
      if (err instanceof BadRequestError) {
        throw err;
      }
      logger.error({ err, url }, 'URL crawling failed');
      throw new BadRequestError(`Failed to crawl URL: ${err.message}`);
    }
  }

  /**
   * Extract clean text content from HTML using cheerio.
   * Removes scripts, styles, navigation, headers, footers, and other boilerplate.
   * Handles Arabic text properly with UTF-8 encoding.
   * @param html - The HTML content to clean
   * @returns Clean text content
   */
  cleanHtmlContent(html: string): string {
    try {
      const $ = cheerio.load(html, {
        decodeEntities: true,
        _useHtmlParser2: true,
      });

      // Remove unwanted elements
      $('script').remove();
      $('style').remove();
      $('nav').remove();
      $('header').remove();
      $('footer').remove();
      $('iframe').remove();
      $('noscript').remove();
      $('svg').remove();

      // Remove common boilerplate classes/IDs
      $('.advertisement').remove();
      $('.ad').remove();
      $('.sidebar').remove();
      $('.cookie-notice').remove();
      $('.cookie-banner').remove();
      $('#cookie-banner').remove();
      $('#advertisement').remove();
      $('[role="complementary"]').remove();
      $('[role="navigation"]').remove();
      $('[aria-label="advertisement"]').remove();

      // Get text from body or main content area
      let textContent = '';

      // Try to find main content area first
      const mainContent = $('main, article, [role="main"], .content, .main-content, #content, #main-content').first();
      if (mainContent.length > 0) {
        textContent = mainContent.text();
      } else {
        // Fallback to body
        textContent = $('body').text();
      }

      // Clean up whitespace while preserving Arabic text
      textContent = textContent
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n')
        .trim();

      return textContent;
    } catch (err) {
      logger.error({ err }, 'HTML content cleaning failed');
      throw new BadRequestError('Failed to parse HTML content');
    }
  }

  /**
   * Extract all links from HTML content.
   * Returns absolute URLs resolved against the base URL.
   * @param html - The HTML content
   * @param baseUrl - The base URL to resolve relative links against
   * @returns Array of absolute URLs
   */
  extractLinks(html: string, baseUrl: string): string[] {
    try {
      const $ = cheerio.load(html);
      const links: string[] = [];
      const parsedBaseUrl = new URL(baseUrl);

      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (!href) return;

        try {
          // Skip anchor links, mailto, tel, javascript, etc.
          if (
            href.startsWith('#') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            href.startsWith('javascript:') ||
            href.startsWith('data:')
          ) {
            return;
          }

          // Resolve relative URLs to absolute
          const absoluteUrl = new URL(href, baseUrl);

          // Only include links from the same domain
          if (absoluteUrl.host === parsedBaseUrl.host) {
            // Normalize URL (remove hash, trailing slash)
            absoluteUrl.hash = '';
            const normalizedUrl = absoluteUrl.href.replace(/\/$/, '');

            if (!links.includes(normalizedUrl)) {
              links.push(normalizedUrl);
            }
          }
        } catch (err) {
          // Invalid URL, skip it
          logger.debug({ href, baseUrl }, 'Skipped invalid link');
        }
      });

      return links;
    } catch (err) {
      logger.error({ err, baseUrl }, 'Link extraction failed');
      return [];
    }
  }

  /**
   * Extract metadata from HTML content.
   * Includes title, description, author, keywords, and language.
   * @param html - The HTML content
   * @param url - The page URL
   * @returns Metadata object
   */
  private extractMetadata(html: string, url: string): CrawlResult['metadata'] {
    try {
      const $ = cheerio.load(html);

      // Extract title
      const title =
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        $('title').text().trim() ||
        undefined;

      // Extract description
      const description =
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="twitter:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        undefined;

      // Extract author
      const author =
        $('meta[name="author"]').attr('content') ||
        $('meta[property="article:author"]').attr('content') ||
        undefined;

      // Extract keywords
      const keywords =
        $('meta[name="keywords"]').attr('content') ||
        undefined;

      // Extract language
      const language =
        $('html').attr('lang') ||
        $('meta[property="og:locale"]').attr('content') ||
        $('meta[http-equiv="content-language"]').attr('content') ||
        undefined;

      return {
        title,
        description,
        author,
        keywords,
        language,
        url,
      };
    } catch (err) {
      logger.error({ err, url }, 'Metadata extraction failed');
      return { url };
    }
  }

  /**
   * Check if a URL matches any of the configured URL patterns.
   * @param url - The URL to check
   * @param patterns - Array of regex patterns
   * @returns true if URL matches any pattern, false otherwise
   */
  matchesUrlPatterns(url: string, patterns: string[]): boolean {
    if (!patterns || patterns.length === 0) {
      return true; // No patterns means all URLs are allowed
    }

    try {
      return patterns.some(pattern => {
        const regex = new RegExp(pattern);
        return regex.test(url);
      });
    } catch (err) {
      logger.error({ err, patterns }, 'Invalid URL pattern');
      return false;
    }
  }
}

export const crawlerService = new CrawlerService();
