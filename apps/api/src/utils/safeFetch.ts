import { lookup } from 'dns/promises';
import { BlockList, isIP } from 'net';
import { BadRequestError } from './errors';

/**
 * Outbound requests to URLs that customers supply (website crawling, webhook
 * delivery) must not be able to reach the server's own network: loopback,
 * private ranges, link-local addresses such as the cloud metadata endpoint, etc.
 * Otherwise a tenant could read internal services through crawl results or
 * webhook delivery logs (server-side request forgery).
 */

const blocked = new BlockList();
// IPv4
blocked.addSubnet('0.0.0.0', 8, 'ipv4'); // "this network"
blocked.addSubnet('10.0.0.0', 8, 'ipv4'); // private
blocked.addSubnet('100.64.0.0', 10, 'ipv4'); // carrier-grade NAT
blocked.addSubnet('127.0.0.0', 8, 'ipv4'); // loopback
blocked.addSubnet('169.254.0.0', 16, 'ipv4'); // link-local (cloud metadata)
blocked.addSubnet('172.16.0.0', 12, 'ipv4'); // private
blocked.addSubnet('192.0.0.0', 24, 'ipv4'); // IETF protocol assignments
blocked.addSubnet('192.168.0.0', 16, 'ipv4'); // private
blocked.addSubnet('198.18.0.0', 15, 'ipv4'); // benchmarking
blocked.addSubnet('224.0.0.0', 4, 'ipv4'); // multicast
blocked.addSubnet('240.0.0.0', 4, 'ipv4'); // reserved + broadcast
// IPv6
blocked.addAddress('::', 'ipv6'); // unspecified
blocked.addAddress('::1', 'ipv6'); // loopback
blocked.addSubnet('64:ff9b::', 96, 'ipv6'); // NAT64
blocked.addSubnet('fc00::', 7, 'ipv6'); // unique local
blocked.addSubnet('fe80::', 10, 'ipv6'); // link-local
blocked.addSubnet('ff00::', 8, 'ipv6'); // multicast

const MAX_REDIRECTS = 5;

/** True for addresses that are not publicly routable. */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blocked.check(address, 'ipv4');
  if (family === 6) {
    // IPv4-mapped IPv6 (::ffff:10.0.0.1) is judged by the IPv4 address it carries
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return blocked.check(mapped[1]!, 'ipv4');
    return blocked.check(address, 'ipv6');
  }
  return true; // not an IP address at all
}

/** Development escape hatch (e.g. crawling a site served from localhost). Never in production. */
function privateHostsAllowed(): boolean {
  return (
    process.env.NODE_ENV !== 'production' && process.env.ALLOW_PRIVATE_OUTBOUND_HOSTS === 'true'
  );
}

/**
 * Throw unless `rawUrl` is an http(s) URL whose host resolves only to public addresses.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestError('Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestError('Only http and https URLs are allowed');
  }
  if (url.username || url.password) {
    throw new BadRequestError('URLs with embedded credentials are not allowed');
  }
  if (privateHostsAllowed()) return url;

  // URL.hostname keeps the brackets around IPv6 literals
  const host = url.hostname.replace(/^\[|\]$/g, '');

  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host, { all: true })).map((entry) => entry.address);
    } catch {
      throw new BadRequestError('Could not resolve the URL host');
    }
  }

  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new BadRequestError('This URL points to a private or internal address');
  }
  return url;
}

/**
 * `fetch` for customer-supplied URLs: validates the target and every redirect
 * hop with assertPublicUrl before requesting it.
 */
export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current);
    const response = await fetch(current, { ...init, redirect: 'manual' });

    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) {
      return response;
    }

    // Drain the redirect body so the connection can be reused
    await response.arrayBuffer().catch(() => undefined);
    current = new URL(location, current).toString();

    // A redirected POST/PUT is retried as GET for 301/302/303, like browsers do
    if (
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) &&
        init.method &&
        init.method !== 'GET' &&
        init.method !== 'HEAD')
    ) {
      init = { ...init, method: 'GET', body: undefined };
    }
  }

  throw new BadRequestError('Too many redirects');
}
