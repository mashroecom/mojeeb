import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_CHANNEL_TYPES,
  decodeCustomerKey,
  encodeCustomerKey,
  escapeLikePattern,
  roundRating,
} from './customerKey';
import { csvSanitize } from './csvSanitize';

describe('customerKey', () => {
  it('round-trips every channel type', () => {
    for (const channelType of CUSTOMER_CHANNEL_TYPES) {
      const key = encodeCustomerKey(channelType, '201001234567');
      expect(decodeCustomerKey(key)).toEqual({ channelType, customerId: '201001234567' });
    }
  });

  it('produces a URL-safe single path segment for awkward identifiers', () => {
    const ids = [
      'visitor/with/slash',
      'a b?c=d&e#f',
      '+20 100 123',
      'زائر-١٢٣',
      '../../etc',
      '%25',
    ];
    for (const id of ids) {
      const key = encodeCustomerKey('WEBCHAT', id);
      expect(key).toMatch(/^wc_[A-Za-z0-9_-]+$/);
      expect(decodeCustomerKey(key)).toEqual({ channelType: 'WEBCHAT', customerId: id });
    }
  });

  it('gives the same identifier a different key per channel type', () => {
    const phone = '966500000001';
    expect(encodeCustomerKey('WHATSAPP', phone)).not.toBe(encodeCustomerKey('WEBCHAT', phone));
    expect(decodeCustomerKey(encodeCustomerKey('WEBCHAT', phone))?.channelType).toBe('WEBCHAT');
  });

  it('rejects malformed keys', () => {
    const bad = [
      '',
      'wa',
      'wa_',
      'xx_YWJj',
      'WA_YWJj',
      'wa_YWJj=',
      'wa_YW Jj',
      'wa_YWJj/..',
      'seedusage_cust_1',
      "wa_'; DROP TABLE conversations;--",
    ];
    for (const key of bad) expect(decodeCustomerKey(key)).toBeNull();
    expect(decodeCustomerKey(undefined as unknown as string)).toBeNull();
  });

  it('rejects non-canonical and invalid UTF-8 encodings', () => {
    // "YWJ" + different trailing bits decodes to the same bytes as a canonical key
    const canonical = encodeCustomerKey('WHATSAPP', 'ab');
    expect(canonical).toBe('wa_YWI');
    expect(decodeCustomerKey('wa_YWJ')).toBeNull();
    // 0xFF is not valid UTF-8
    expect(decodeCustomerKey(`wa_${Buffer.from([0xff, 0xfe]).toString('base64url')}`)).toBeNull();
  });

  it('rejects oversized identifiers', () => {
    expect(decodeCustomerKey(encodeCustomerKey('WEBCHAT', 'x'.repeat(513)))).toBeNull();
    expect(decodeCustomerKey(encodeCustomerKey('WEBCHAT', 'x'.repeat(512)))).not.toBeNull();
  });
});

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
    expect(escapeLikePattern('c:\\dir')).toBe('c:\\\\dir');
    expect(escapeLikePattern('plain text')).toBe('plain text');
  });
});

describe('roundRating', () => {
  it('rounds to two decimals and keeps null for no ratings', () => {
    expect(roundRating(4.333333)).toBe(4.33);
    expect(roundRating(5)).toBe(5);
    expect(roundRating(null)).toBeNull();
    expect(roundRating(undefined)).toBeNull();
  });
});

describe('csvSanitize (used by the customers export)', () => {
  it('neutralises formula injection', () => {
    expect(csvSanitize('=HYPERLINK("http://evil","x")')).toBe(
      '"\'=HYPERLINK(""http://evil"",""x"")"',
    );
    expect(csvSanitize('+201001234567')).toBe("'+201001234567");
    expect(csvSanitize('-1+1')).toBe("'-1+1");
    expect(csvSanitize('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('quotes commas, quotes and newlines and handles empty values', () => {
    expect(csvSanitize('Nour, Ali')).toBe('"Nour, Ali"');
    expect(csvSanitize('say "hi"')).toBe('"say ""hi"""');
    expect(csvSanitize('line1\nline2')).toBe('"line1\nline2"');
    expect(csvSanitize(null)).toBe('');
    expect(csvSanitize(undefined)).toBe('');
    expect(csvSanitize(12)).toBe('12');
    expect(csvSanitize('منى')).toBe('منى');
  });
});
