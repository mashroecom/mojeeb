import { describe, it, expect } from 'vitest';
import { isValidVisitorId, visitorConversationWhere, visitorIdFromQuery } from './webchatAccess';

describe('isValidVisitorId', () => {
  it('accepts non-empty strings up to 200 characters', () => {
    expect(isValidVisitorId('v_123')).toBe(true);
    expect(isValidVisitorId('x'.repeat(200))).toBe(true);
  });

  it('rejects everything else', () => {
    for (const bad of ['', 'x'.repeat(201), undefined, null, 42, {}, ['v_1'], true]) {
      expect(isValidVisitorId(bad)).toBe(false);
    }
  });
});

describe('visitorIdFromQuery', () => {
  it('returns the id only for a single string value', () => {
    expect(visitorIdFromQuery('v_1')).toBe('v_1');
    expect(visitorIdFromQuery(['v_1', 'v_2'])).toBeNull();
    expect(visitorIdFromQuery({ $ne: '' })).toBeNull();
    expect(visitorIdFromQuery(undefined)).toBeNull();
  });
});

describe('visitorConversationWhere', () => {
  it('scopes the conversation to both the channel and the visitor', () => {
    expect(visitorConversationWhere('ch_1', 'conv_1', 'v_1')).toEqual({
      id: 'conv_1',
      channelId: 'ch_1',
      customerId: 'v_1',
    });
  });

  it('refuses to build a filter when the visitor id is missing or malformed', () => {
    expect(visitorConversationWhere('ch_1', 'conv_1', undefined)).toBeNull();
    expect(visitorConversationWhere('ch_1', 'conv_1', '')).toBeNull();
    expect(visitorConversationWhere('ch_1', 'conv_1', { not: 'x' })).toBeNull();
    expect(visitorConversationWhere('ch_1', 'conv_1', null)).toBeNull();
  });

  it('refuses to build a filter without a channel or conversation', () => {
    expect(visitorConversationWhere('', 'conv_1', 'v_1')).toBeNull();
    expect(visitorConversationWhere('ch_1', undefined, 'v_1')).toBeNull();
  });
});
