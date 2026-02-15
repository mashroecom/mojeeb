import type { ChannelAdapter } from './base.adapter';
import { WebchatAdapter } from './webchat.adapter';
import { WhatsAppAdapter } from './whatsapp.adapter';

const adapters = new Map<string, ChannelAdapter>();

export function getChannelAdapter(channelType: string): ChannelAdapter {
  if (!adapters.has(channelType)) {
    switch (channelType) {
      case 'WEBCHAT':
        adapters.set(channelType, new WebchatAdapter());
        break;
      case 'WHATSAPP':
        adapters.set(channelType, new WhatsAppAdapter());
        break;
      // Future: MESSENGER, INSTAGRAM
      default:
        throw new Error(`Unknown channel type: ${channelType}`);
    }
  }
  return adapters.get(channelType)!;
}
