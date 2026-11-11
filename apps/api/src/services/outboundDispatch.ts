/**
 * Pure routing decisions for outbound messages (no I/O, safe to unit test).
 *
 * Web chat is our own transport: a message reaches the visitor over the socket or the
 * widget's fetch, so nothing has to be "sent". Every other channel is an external provider
 * and the message only leaves the platform when the outbound worker hands it to the adapter.
 */
export function channelNeedsOutboundSend(channelType: string): boolean {
  return channelType !== 'WEBCHAT';
}

/**
 * Status a newly written agent message starts in: QUEUED while it waits for the provider
 * send, SENT when storing it is all the sending there is (web chat).
 */
export function initialDeliveryStatus(channelType: string): 'QUEUED' | 'SENT' {
  return channelNeedsOutboundSend(channelType) ? 'QUEUED' : 'SENT';
}

/** One queue job per message: adding the same message twice does not send it twice. */
export function outboundJobId(messageId: string): string {
  return `outbound-${messageId}`;
}
