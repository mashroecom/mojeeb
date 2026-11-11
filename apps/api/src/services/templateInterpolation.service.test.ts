import { describe, expect, it } from 'vitest';
import { templateInterpolationService as service } from './templateInterpolation.service';

describe('TemplateInterpolationService', () => {
  describe('interpolate', () => {
    it('replaces every occurrence of a known variable', () => {
      expect(
        service.interpolate('Hi {{customer_name}}! Bye {{customer_name}}.', {
          customer_name: 'Omar',
        }),
      ).toBe('Hi Omar! Bye Omar.');
    });

    it('keeps the placeholder for variables that were not provided', () => {
      expect(service.interpolate('Order {{order_number}} for {{customer_name}}', {})).toBe(
        'Order {{order_number}} for {{customer_name}}',
      );
    });

    it('treats an empty string as a provided value', () => {
      expect(service.interpolate('[{{customer_name}}]', { customer_name: '' })).toBe('[]');
    });

    it('works with Arabic text', () => {
      expect(service.interpolate('مرحباً {{customer_name}}', { customer_name: 'سارة' })).toBe(
        'مرحباً سارة',
      );
    });

    it('returns an empty string for an empty template', () => {
      expect(service.interpolate('', { customer_name: 'Omar' })).toBe('');
    });
  });

  describe('extractVariables', () => {
    it('lists each variable once, in order of first appearance', () => {
      expect(service.extractVariables('{{b}} {{a}} {{b}} {{c}}')).toEqual(['b', 'a', 'c']);
    });

    it('ignores malformed placeholders', () => {
      expect(service.extractVariables('{{ spaced }} {single} {{ok}} {{}}')).toEqual(['ok']);
    });

    it('returns an empty list for an empty template', () => {
      expect(service.extractVariables('')).toEqual([]);
    });
  });

  describe('validate', () => {
    it('reports missing variables', () => {
      expect(
        service.validate('{{customer_name}} / {{order_number}}', { customer_name: 'Omar' }),
      ).toEqual({ isValid: false, missing: ['order_number'] });
    });

    it('is valid when every variable is provided', () => {
      expect(service.validate('{{customer_name}}', { customer_name: 'Omar' })).toEqual({
        isValid: true,
        missing: [],
      });
    });
  });

  describe('interpolateBilingual', () => {
    it('interpolates both languages and tolerates a missing Arabic body', () => {
      expect(
        service.interpolateBilingual(
          { content: 'Hello {{customer_name}}', contentAr: 'مرحباً {{customer_name}}' },
          { customer_name: 'Omar' },
        ),
      ).toEqual({ content: 'Hello Omar', contentAr: 'مرحباً Omar' });

      expect(
        service.interpolateBilingual(
          { content: 'Hello {{customer_name}}' },
          { customer_name: 'O' },
        ),
      ).toEqual({ content: 'Hello O', contentAr: '' });
    });
  });
});
