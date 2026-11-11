import { describe, expect, it } from 'vitest';
import {
  decodeTemplateVariables,
  encodeTemplateVariables,
  withDecodedVariables,
} from './templateVariables';

describe('templateVariables', () => {
  it('round-trips variable definitions through the text[] column format', () => {
    const variables = [
      { key: 'order_id', labelEn: 'Order ID', labelAr: 'رقم الطلب' },
      { key: 'eta', labelEn: 'ETA', labelAr: '' },
    ];

    const stored = encodeTemplateVariables(variables);

    expect(stored).toHaveLength(2);
    expect(stored.every((s) => typeof s === 'string')).toBe(true);
    expect(decodeTemplateVariables(stored)).toEqual(variables);
  });

  it('defaults a missing Arabic label to an empty string when encoding', () => {
    const [stored] = encodeTemplateVariables([{ key: 'name', labelEn: 'Name' }]);
    expect(JSON.parse(stored!)).toEqual({ key: 'name', labelEn: 'Name', labelAr: '' });
  });

  it('reads legacy rows that store a bare variable key', () => {
    expect(decodeTemplateVariables(['customer_name'])).toEqual([
      { key: 'customer_name', labelEn: 'customer_name', labelAr: '' },
    ]);
  });

  it('falls back to the key when a stored definition has no English label', () => {
    expect(decodeTemplateVariables(['{"key":"city"}'])).toEqual([
      { key: 'city', labelEn: 'city', labelAr: '' },
    ]);
  });

  it('treats malformed or key-less JSON as a bare key instead of throwing', () => {
    expect(decodeTemplateVariables(['{not json'])).toEqual([
      { key: '{not json', labelEn: '{not json', labelAr: '' },
    ]);
    expect(decodeTemplateVariables(['{"labelEn":"No key"}'])[0]!.key).toBe('{"labelEn":"No key"}');
  });

  it('handles empty and missing input', () => {
    expect(decodeTemplateVariables([])).toEqual([]);
    expect(decodeTemplateVariables(null)).toEqual([]);
    expect(decodeTemplateVariables(undefined)).toEqual([]);
    expect(encodeTemplateVariables([])).toEqual([]);
  });

  it('withDecodedVariables replaces only the variables field', () => {
    const row = {
      id: 't1',
      title: 'Welcome',
      variables: encodeTemplateVariables([{ key: 'order_id', labelEn: 'Order ID' }]),
    };

    expect(withDecodedVariables(row)).toEqual({
      id: 't1',
      title: 'Welcome',
      variables: [{ key: 'order_id', labelEn: 'Order ID', labelAr: '' }],
    });
  });
});
