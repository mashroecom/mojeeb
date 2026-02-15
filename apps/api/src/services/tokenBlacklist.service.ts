import { redis } from '../config/redis';

const BLACKLIST_PREFIX = 'token:bl:';

class TokenBlacklistService {
  async blacklist(jti: string, expiresAt: number): Promise<void> {
    const ttl = Math.max(expiresAt - Math.floor(Date.now() / 1000), 0);
    if (ttl > 0) {
      await redis.set(`${BLACKLIST_PREFIX}${jti}`, '1', 'EX', ttl);
    }
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    const result = await redis.get(`${BLACKLIST_PREFIX}${jti}`);
    return result === '1';
  }
}

export const tokenBlacklistService = new TokenBlacklistService();
