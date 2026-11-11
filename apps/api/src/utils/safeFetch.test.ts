import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertPublicUrl, isPrivateAddress, safeFetch } from './safeFetch';

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '127.255.255.254',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.10',
    '169.254.169.254', // cloud metadata endpoint
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:10.1.2.3',
  ])('treats %s as private', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.32.0.1',
    '192.169.0.1',
    '2606:4700:4700::1111',
    '::ffff:8.8.8.8',
  ])('treats %s as public', (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });

  it('treats anything that is not an IP address as private', () => {
    expect(isPrivateAddress('localhost')).toBe(true);
    expect(isPrivateAddress('')).toBe(true);
  });
});

describe('assertPublicUrl', () => {
  it.each([
    'http://127.0.0.1/',
    'http://127.0.0.1:6379/',
    'http://[::1]:4000/api',
    'http://169.254.169.254/latest/meta-data/',
    'http://192.168.0.1/admin',
    'http://localhost:5432/',
  ])('rejects %s', async (url) => {
    await expect(assertPublicUrl(url)).rejects.toThrow(/private or internal/);
  });

  it('rejects non-http(s) schemes', async () => {
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow(/http and https/);
    await expect(assertPublicUrl('ftp://8.8.8.8/')).rejects.toThrow(/http and https/);
  });

  it('rejects URLs with embedded credentials and malformed URLs', async () => {
    await expect(assertPublicUrl('http://user:pass@8.8.8.8/')).rejects.toThrow(/credentials/);
    await expect(assertPublicUrl('not a url')).rejects.toThrow(/Invalid URL/);
  });

  it('accepts a public IP literal', async () => {
    const url = await assertPublicUrl('https://8.8.8.8/path?q=1');
    expect(url.hostname).toBe('8.8.8.8');
  });
});

describe('safeFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not request a private target', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(safeFetch('http://127.0.0.1:6379/')).rejects.toThrow(/private or internal/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('follows a redirect to a public address', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/next' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await safeFetch('http://8.8.8.8/start');

    expect(await res.text()).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toBe('http://8.8.8.8/next');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ redirect: 'manual' });
  });

  it('refuses a redirect that points at an internal address', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data/' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(safeFetch('http://8.8.8.8/start')).rejects.toThrow(/private or internal/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after too many redirects', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async () => new Response(null, { status: 302, headers: { location: '/loop' } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(safeFetch('http://8.8.8.8/loop')).rejects.toThrow(/Too many redirects/);
  });
});
