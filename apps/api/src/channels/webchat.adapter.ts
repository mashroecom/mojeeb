import type { Request, Response } from 'express';
import { MessageContentType } from '@mojeeb/shared-types';
import type { InboundMessage, OutboundMessage, SendResult } from '@mojeeb/shared-types';
import { ChannelAdapter } from './base.adapter';

/**
 * Webchat adapter for built-in chat widget.
 * Messages are handled via WebSocket, so send/receive is direct.
 */
export class WebchatAdapter extends ChannelAdapter {
  readonly channelType = 'WEBCHAT';

  verifyWebhook(_req: Request): boolean {
    return true; // Webchat doesn't use webhooks
  }

  handleVerificationChallenge(_req: Request, res: Response): void {
    res.sendStatus(200);
  }

  parseInbound(payload: unknown): InboundMessage[] {
    const data = payload as {
      senderId: string;
      senderName?: string;
      content: string;
      timestamp?: string;
    };

    return [
      {
        externalMessageId: `webchat_${Date.now()}`,
        senderId: data.senderId,
        senderName: data.senderName,
        content: data.content,
        contentType: MessageContentType.TEXT,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        rawPayload: payload,
      },
    ];
  }

  async sendMessage(
    _credentials: Record<string, string>,
    message: OutboundMessage
  ): Promise<SendResult> {
    // Webchat messages are sent via WebSocket, not via external API
    // This adapter just acknowledges the send
    return {
      externalId: `webchat_reply_${Date.now()}`,
      success: true,
    };
  }
}
