import { describe, it, expect } from 'vitest';
import { channelNeedsOutboundSend, initialDeliveryStatus, outboundJobId } from './outboundDispatch';

describe('channelNeedsOutboundSend', () => {
  it('is false only for web chat, which is delivered over our own socket', () => {
    expect(channelNeedsOutboundSend('WEBCHAT')).toBe(false);
    for (const type of ['WHATSAPP', 'MESSENGER', 'INSTAGRAM']) {
      expect(channelNeedsOutboundSend(type)).toBe(true);
    }
  });
});

describe('initialDeliveryStatus', () => {
  it('starts provider messages QUEUED and web chat messages SENT', () => {
    expect(initialDeliveryStatus('WHATSAPP')).toBe('QUEUED');
    expect(initialDeliveryStatus('WEBCHAT')).toBe('SENT');
  });
});

describe('outboundJobId', () => {
  it('is stable per message so a message cannot be queued twice', () => {
    expect(outboundJobId('msg_1')).toBe(outboundJobId('msg_1'));
    expect(outboundJobId('msg_1')).not.toBe(outboundJobId('msg_2'));
    expect(outboundJobId('msg_1')).not.toContain(':');
  });
});
