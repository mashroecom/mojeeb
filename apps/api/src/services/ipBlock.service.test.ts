import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  maxLoginAttempts: 10,
  failedCount: 0,
  prisma: {
    blockedIP: {
      findUnique: vi.fn(async (): Promise<unknown> => null),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => args.data),
    },
  },
  redis: { get: vi.fn(), set: vi.fn(async () => 'OK'), del: vi.fn() },
}));

vi.mock('../config/database', () => ({ prisma: mocks.prisma }));
vi.mock('../config/redis', () => ({ redis: mocks.redis }));
vi.mock('../config/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));
vi.mock('./loginActivity.service', () => ({
  loginActivityService: { getFailedCountByIP: vi.fn(async () => mocks.failedCount) },
}));
vi.mock('./systemSettings.service', () => ({
  systemSettings: {
    security: vi.fn(async () => ({ maxLoginAttempts: mocks.maxLoginAttempts })),
  },
}));

import { ipAutoBlockThreshold, ipBlockService, isLoopbackAddress } from './ipBlock.service';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.maxLoginAttempts = 10;
  mocks.failedCount = 0;
  mocks.prisma.blockedIP.findUnique.mockResolvedValue(null);
});

describe('ipAutoBlockThreshold', () => {
  it('keeps the built-in threshold of 10 at the default setting', () => {
    expect(ipAutoBlockThreshold(10)).toBe(10);
  });

  it('never blocks an IP before the account lockout can trigger', () => {
    expect(ipAutoBlockThreshold(3)).toBe(10);
    expect(ipAutoBlockThreshold(25)).toBe(25);
  });
});

describe('isLoopbackAddress', () => {
  it('recognises loopback addresses only', () => {
    for (const ip of ['127.0.0.1', '127.1.2.3', '::1', '::ffff:127.0.0.1']) {
      expect(isLoopbackAddress(ip), ip).toBe(true);
    }
    for (const ip of ['203.0.113.7', '10.0.0.1', '::ffff:10.0.0.1', '2001:db8::1']) {
      expect(isLoopbackAddress(ip), ip).toBe(false);
    }
  });
});

describe('autoBlockCheck', () => {
  it('does not block below the threshold', async () => {
    mocks.failedCount = 9;
    await ipBlockService.autoBlockCheck('203.0.113.7');
    expect(mocks.prisma.blockedIP.create).not.toHaveBeenCalled();
  });

  it('blocks for 24 hours at the threshold, with no blocker user', async () => {
    mocks.failedCount = 10;
    const before = Date.now();
    await ipBlockService.autoBlockCheck('203.0.113.7');
    expect(mocks.prisma.blockedIP.create).toHaveBeenCalledTimes(1);
    const data = mocks.prisma.blockedIP.create.mock.calls[0]![0].data;
    expect(data.ip).toBe('203.0.113.7');
    expect(data.autoBlock).toBe(true);
    // blockedBy is a foreign key to users: an automatic block must not invent an id.
    expect(data.blockedBy).toBeUndefined();
    const expiresAt = (data.expiresAt as Date).getTime();
    expect(expiresAt - before).toBeGreaterThanOrEqual(24 * 3600 * 1000 - 1000);
    expect(expiresAt - before).toBeLessThanOrEqual(24 * 3600 * 1000 + 5000);
  });

  it('follows a higher MAX_LOGIN_ATTEMPTS', async () => {
    mocks.maxLoginAttempts = 20;
    mocks.failedCount = 15;
    await ipBlockService.autoBlockCheck('203.0.113.7');
    expect(mocks.prisma.blockedIP.create).not.toHaveBeenCalled();

    mocks.failedCount = 20;
    await ipBlockService.autoBlockCheck('203.0.113.7');
    expect(mocks.prisma.blockedIP.create).toHaveBeenCalledTimes(1);
  });

  it('never auto-blocks loopback', async () => {
    mocks.failedCount = 500;
    await ipBlockService.autoBlockCheck('127.0.0.1');
    await ipBlockService.autoBlockCheck('::1');
    expect(mocks.prisma.blockedIP.create).not.toHaveBeenCalled();
  });

  it('does nothing when the IP is already blocked', async () => {
    mocks.failedCount = 50;
    mocks.prisma.blockedIP.findUnique.mockResolvedValue({ id: 'b1' });
    await ipBlockService.autoBlockCheck('203.0.113.7');
    expect(mocks.prisma.blockedIP.create).not.toHaveBeenCalled();
  });
});
