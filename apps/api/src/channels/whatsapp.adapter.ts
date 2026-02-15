import crypto from 'crypto';
import type { Request, Response } from 'express';
import type { InboundMessage, OutboundMessage, SendResult } from '@mojeeb/shared-types';
import { ChannelAdapter } from './base.adapter';
import { config } from '../config';
import { logger } from '../config/logger';

export class WhatsAppAdapter extends ChannelAdapter {
  readonly channelType = 'WHATSAPP';

  verifyWebhook(req: Request): boolean {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature || !config.meta.appSecret) return false;

    // Use the raw body preserved by express.json verify callback for accurate signature verification.
    // Falling back to JSON.stringify can produce different byte output than the original payload.
    const body = (req as any).rawBody
      ? (req as any).rawBody
      : Buffer.from(JSON.stringify(req.body));

    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', config.meta.appSecret)
      .update(body)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature),
      );
    } catch {
      return false;
    }
  }

  handleVerificationChallenge(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.meta.verifyToken) {
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
    message: OutboundMessage
  ): Promise<SendResult> {
    try {
      const phoneNumberId = credentials.phoneNumberId;
      const accessToken = credentials.accessToken;

      if (!phoneNumberId || !accessToken) {
        return { externalId: '', success: false, error: 'Missing WhatsApp credentials (phoneNumberId or accessToken)' };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
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
        }
      );

      clearTimeout(timeout);

      let data: any;
      try {
        data = await response.json();
      } catch {
        return { externalId: '', success: false, error: 'Invalid response format from WhatsApp API' };
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
