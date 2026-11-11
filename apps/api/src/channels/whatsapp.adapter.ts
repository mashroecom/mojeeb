import type { Request, Response } from 'express';
import type { InboundMessage, OutboundMessage, SendResult } from '@mojeeb/shared-types';
import { ChannelAdapter } from './base.adapter';
import { config } from '../config';
import { logger } from '../config/logger';
import { matchesVerifyToken, verifyMetaSignature } from './whatsapp.routing';

// Overridable so tests can point sends at a local stand-in; production uses the default.
const GRAPH_API_BASE_URL = (
  process.env.WHATSAPP_GRAPH_API_URL || 'https://graph.facebook.com/v21.0'
).replace(/\/+$/, '');

export class WhatsAppAdapter extends ChannelAdapter {
  readonly channelType = 'WHATSAPP';

  /** Platform-level check (env META_APP_SECRET). Per-channel secrets: see the webhook route. */
  verifyWebhook(req: Request): boolean {
    // Use the raw body preserved by express.json verify callback for accurate signature verification.
    // Falling back to JSON.stringify can produce different byte output than the original payload.
    const body: Buffer = (req as any).rawBody
      ? (req as any).rawBody
      : Buffer.from(JSON.stringify(req.body));

    return verifyMetaSignature(body, req.headers['x-hub-signature-256'], config.meta.appSecret);
  }

  handleVerificationChallenge(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const challenge = req.query['hub.challenge'];

    // matchesVerifyToken rejects an empty token, so an unset META_VERIFY_TOKEN matches nothing
    if (
      mode === 'subscribe' &&
      matchesVerifyToken(req.query['hub.verify_token'], [config.meta.verifyToken])
    ) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }

  parseInbound(payload: unknown): InboundMessage[] {
    const messages: InboundMessage[] = [];
    const data = payload as any;

    try {
      for (const entry of data.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;

          for (const msg of change.value?.messages || []) {
            messages.push({
              externalMessageId: msg.id,
              senderId: msg.from,
              senderPhone: msg.from,
              senderName: change.value?.contacts?.[0]?.profile?.name,
              content: msg.text?.body || msg.caption || '',
              contentType: this.mapContentType(msg.type),
              timestamp: (() => {
                const ts = parseInt(msg.timestamp, 10);
                return isNaN(ts) ? new Date() : new Date(ts * 1000);
              })(),
              rawPayload: msg,
            });
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to parse WhatsApp webhook payload');
    }

    return messages;
  }

  async sendMessage(
    credentials: Record<string, string>,
    message: OutboundMessage,
  ): Promise<SendResult> {
    try {
      const phoneNumberId = credentials.phoneNumberId;
      const accessToken = credentials.accessToken;

      if (!phoneNumberId || !accessToken) {
        return {
          externalId: '',
          success: false,
          error: 'Missing WhatsApp credentials (phoneNumberId or accessToken)',
        };
      }

      // Only text is implemented. Fail visibly instead of sending a file path as text.
      if (message.contentType !== 'TEXT') {
        return {
          externalId: '',
          success: false,
          error: `WhatsApp sending supports text only (got ${message.contentType})`,
        };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${GRAPH_API_BASE_URL}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: message.recipientId,
          type: 'text',
          text: { body: message.content },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      let data: any;
      try {
        data = await response.json();
      } catch {
        return {
          externalId: '',
          success: false,
          error: 'Invalid response format from WhatsApp API',
        };
      }

      return {
        externalId: data.messages?.[0]?.id || '',
        success: response.ok,
        error: response.ok ? undefined : JSON.stringify(data.error),
      };
    } catch (err) {
      logger.error({ err }, 'WhatsApp send failed');
      return { externalId: '', success: false, error: String(err) };
    }
  }

  private mapContentType(type: string): any {
    const mapping: Record<string, string> = {
      text: 'TEXT',
      image: 'IMAGE',
      audio: 'AUDIO',
      video: 'VIDEO',
      document: 'DOCUMENT',
      location: 'LOCATION',
      contacts: 'CONTACT',
    };
    return mapping[type] || 'TEXT';
  }
}
