import type { Request, Response } from 'express';
import type { InboundMessage, OutboundMessage, SendResult } from '@mojeeb/shared-types';

export abstract class ChannelAdapter {
  abstract readonly channelType: string;

  abstract verifyWebhook(req: Request): boolean;

  abstract handleVerificationChallenge(req: Request, res: Response): void;

  abstract parseInbound(payload: unknown): InboundMessage[];

  abstract sendMessage(
    credentials: Record<string, string>,
    message: OutboundMessage,
  ): Promise<SendResult>;
}
