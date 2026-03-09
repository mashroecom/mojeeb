import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateInterpolationService } from './templateInterpolation.service';

describe('TemplateInterpolationService', () => {
  let service: TemplateInterpolationService;

  beforeEach(() => {
    service = new TemplateInterpolationService();
  });

  // -----------------------------------------------------------------------
  // interpolate() method
  // -----------------------------------------------------------------------
  describe('interpolate', () => {
    it('should replace single variable', () => {
      const template = 'Hello {{customer_name}}!';
      const variables = { customer_name: 'John' };
      const result = service.interpolate(template, variables);
      expect(result).toBe('Hello John!');
    });

    it('should replace multiple variables', () => {
      const template = 'Hello {{customer_name}}, your order {{order_number}} is ready!';
      const variables = { customer_name: 'Jane', order_number: '#12345' };
      const result = service.interpolate(template, variables);
      expect(result).toBe('Hello Jane, your order #12345 is ready!');
    });

    it('should replace the same variable multiple times', () => {
      const template = '{{customer_name}} is a valued customer. Thank you {{customer_name}}!';
      const variables = { customer_name: 'Alice' };
      const result = service.interpolate(template, variables);
      expect(result).toBe('Alice is a valued customer. Thank you Alice!');
    });

    it('should keep placeholder if variable is not provided', () => {
      const template = 'Hello {{customer_name}}, your agent is {{agent_name}}.';
      const variables = { customer_name: 'Bob' };
      const result = service.interpolate(template, variables);
      expect(result).toBe('Hello Bob, your agent is {{agent_name}}.');
    });

    it('should handle empty template', () => {
      const result = service.interpolate('', { customer_name: 'Test' });
      expect(result).toBe('');
    });

    it('should handle template with no variables', () => {
      const template = 'This is a plain message with no variables.';
      const result = service.interpolate(template, {});
      expect(result).toBe('This is a plain message with no variables.');
    });

    it('should handle Arabic content', () => {
      const template = 'مرحباً {{customer_name}}، رقم طلبك {{order_number}}';
      const variables = { customer_name: 'أحمد', order_number: '#12345' };
      const result = service.interpolate(template, variables);
      expect(result).toBe('مرحباً أحمد، رقم طلبك #12345');
    });

    it('should replace all supported variables', () => {
      const template =
        'Hi {{customer_name}}, agent {{agent_name}} is handling conversation {{conversation_id}} about order {{order_number}}';
      const variables = {
        customer_name: 'Sarah',
        agent_name: 'Michael',
        conversation_id: 'conv-123',
        order_number: '#ORD-456',
      };
      const result = service.interpolate(template, variables);
      expect(result).toBe(
        'Hi Sarah, agent Michael is handling conversation conv-123 about order #ORD-456'
      );
    });

    it('should handle custom variables', () => {
      const template = 'Your {{item_name}} costs {{price}}';
      const variables = { item_name: 'Widget', price: '$19.99' };
      const result = service.interpolate(template, variables);
      expect(result).toBe('Your Widget costs $19.99');
    });
  });

  // -----------------------------------------------------------------------
  // extractVariables() method
  // -----------------------------------------------------------------------
  describe('extractVariables', () => {
    it('should extract single variable', () => {
      const template = 'Hello {{customer_name}}!';
      const variables = service.extractVariables(template);
      expect(variables).toEqual(['customer_name']);
    });

    it('should extract multiple variables', () => {
      const template = 'Hello {{customer_name}}, order {{order_number}} is ready!';
      const variables = service.extractVariables(template);
      expect(variables).toEqual(['customer_name', 'order_number']);
    });

    it('should extract duplicate variables only once', () => {
      const template = '{{customer_name}} is valued. Thank you {{customer_name}}!';
      const variables = service.extractVariables(template);
      expect(variables).toEqual(['customer_name']);
    });

    it('should return empty array for template with no variables', () => {
      const template = 'This is a plain message.';
      const variables = service.extractVariables(template);
      expect(variables).toEqual([]);
    });

    it('should return empty array for empty template', () => {
      const variables = service.extractVariables('');
      expect(variables).toEqual([]);
    });

    it('should extract variables from Arabic content', () => {
      const template = 'مرحباً {{customer_name}}، رقم طلبك {{order_number}}';
      const variables = service.extractVariables(template);
      expect(variables).toEqual(['customer_name', 'order_number']);
    });
  });

  // -----------------------------------------------------------------------
  // validate() method
  // -----------------------------------------------------------------------
  describe('validate', () => {
    it('should return valid when all variables are provided', () => {
      const template = 'Hello {{customer_name}}, order {{order_number}} is ready!';
      const variables = { customer_name: 'John', order_number: '#123' };
      const result = service.validate(template, variables);
      expect(result.isValid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should return invalid when variables are missing', () => {
      const template = 'Hello {{customer_name}}, order {{order_number}} is ready!';
      const variables = { customer_name: 'John' };
      const result = service.validate(template, variables);
      expect(result.isValid).toBe(false);
      expect(result.missing).toEqual(['order_number']);
    });

    it('should return all missing variables', () => {
      const template =
        'Hi {{customer_name}}, agent {{agent_name}} is handling {{conversation_id}}';
      const variables = { customer_name: 'Alice' };
      const result = service.validate(template, variables);
      expect(result.isValid).toBe(false);
      expect(result.missing).toEqual(['agent_name', 'conversation_id']);
    });

    it('should return valid for template with no variables', () => {
      const template = 'This is a plain message.';
      const result = service.validate(template, {});
      expect(result.isValid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // interpolateBilingual() method
  // -----------------------------------------------------------------------
  describe('interpolateBilingual', () => {
    it('should interpolate both English and Arabic content', () => {
      const template = {
        content: 'Hello {{customer_name}}!',
        contentAr: 'مرحباً {{customer_name}}!',
      };
      const variables = { customer_name: 'Ahmed' };
      const result = service.interpolateBilingual(template, variables);
      expect(result.content).toBe('Hello Ahmed!');
      expect(result.contentAr).toBe('مرحباً Ahmed!');
    });

    it('should handle missing Arabic content', () => {
      const template = {
        content: 'Hello {{customer_name}}!',
      };
      const variables = { customer_name: 'John' };
      const result = service.interpolateBilingual(template, variables);
      expect(result.content).toBe('Hello John!');
      expect(result.contentAr).toBe('');
    });

    it('should handle empty Arabic content', () => {
      const template = {
        content: 'Hello {{customer_name}}!',
        contentAr: '',
      };
      const variables = { customer_name: 'Sarah' };
      const result = service.interpolateBilingual(template, variables);
      expect(result.content).toBe('Hello Sarah!');
      expect(result.contentAr).toBe('');
    });

    it('should interpolate complex bilingual templates', () => {
      const template = {
        content:
          'Hello {{customer_name}}, your order {{order_number}} will be delivered by {{agent_name}}.',
        contentAr:
          'مرحباً {{customer_name}}، طلبك رقم {{order_number}} سيتم توصيله بواسطة {{agent_name}}.',
      };
      const variables = {
        customer_name: 'محمد',
        order_number: '#12345',
        agent_name: 'علي',
      };
      const result = service.interpolateBilingual(template, variables);
      expect(result.content).toBe(
        'Hello محمد, your order #12345 will be delivered by علي.'
      );
      expect(result.contentAr).toBe(
        'مرحباً محمد، طلبك رقم #12345 سيتم توصيله بواسطة علي.'
      );
    });
  });
});
