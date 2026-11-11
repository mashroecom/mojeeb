import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  settings: {
    events: {
      NEW_USER_SIGNUP: true,
      NEW_ORG_CREATED: true,
      FAILED_PAYMENT: true,
      SYSTEM_ERRORS: true,
      NEW_CONTACT_MESSAGE: true,
      NEW_DEMO_REQUEST: true,
    },
    alertEmail: null as string | null,
  },
  prisma: {
    user: { findMany: vi.fn(async () => [{ id: 'admin-1' }]) },
    adminNotification: { create: vi.fn((args: unknown) => args) },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
  emailAdd: vi.fn(async () => undefined),
  redisSet: vi.fn(async (): Promise<string | null> => 'OK'),
}));

vi.mock('../config/database', () => ({ prisma: mocks.prisma }));
vi.mock('../config/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));
vi.mock('../config/redis', () => ({ redis: { set: mocks.redisSet } }));
vi.mock('../queues', () => ({ emailQueue: { add: mocks.emailAdd } }));
vi.mock('../websocket', () => ({ emitToAdmin: vi.fn() }));
vi.mock('./systemSettings.service', () => ({
  systemSettings: { notifications: vi.fn(async () => mocks.settings) },
}));

import { adminNotificationService as service } from './adminNotification.service';

const alert = { type: 'NEW_DEMO_REQUEST', title: 'New Demo Request', body: 'Someone asked.' };
const registration = {
  firstName: 'Sara',
  lastName: 'Ali',
  email: 'sara@example.com',
  organizationName: 'Acme',
};

function createdTypes(): string[] {
  return mocks.prisma.adminNotification.create.mock.calls.map(
    (call) => (call[0] as { data: { type: string } }).data.type,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redisSet.mockResolvedValue('OK');
  mocks.settings.alertEmail = null;
  for (const key of Object.keys(mocks.settings.events)) {
    mocks.settings.events[key as keyof typeof mocks.settings.events] = true;
  }
});

describe('notifyEvent', () => {
  it('creates the in-app notification when the event is enabled', async () => {
    expect(await service.notifyEvent('NEW_DEMO_REQUEST', alert)).toBe(true);
    expect(createdTypes()).toEqual(['NEW_DEMO_REQUEST']);
    expect(mocks.emailAdd).not.toHaveBeenCalled();
  });

  it('sends nothing when the event is switched off', async () => {
    mocks.settings.events.NEW_DEMO_REQUEST = false;
    mocks.settings.alertEmail = 'ops@example.com';
    expect(await service.notifyEvent('NEW_DEMO_REQUEST', alert)).toBe(false);
    expect(mocks.prisma.adminNotification.create).not.toHaveBeenCalled();
    expect(mocks.emailAdd).not.toHaveBeenCalled();
  });

  it('also emails the alert address when one is configured', async () => {
    mocks.settings.alertEmail = 'ops@example.com';
    await service.notifyEvent('NEW_DEMO_REQUEST', alert);
    expect(mocks.emailAdd).toHaveBeenCalledWith('custom', {
      type: 'custom',
      to: 'ops@example.com',
      subject: '[Mojeeb Admin] New Demo Request',
      body: 'Someone asked.',
    });
  });
});

describe('notifyRegistration', () => {
  it('sends the single combined alert by default', async () => {
    await service.notifyRegistration(registration);
    expect(createdTypes()).toEqual(['NEW_USER']);
  });

  it('falls back to an organization alert when user alerts are off', async () => {
    mocks.settings.events.NEW_USER_SIGNUP = false;
    await service.notifyRegistration(registration);
    expect(createdTypes()).toEqual(['NEW_ORG']);
  });

  it('sends nothing when both are off', async () => {
    mocks.settings.events.NEW_USER_SIGNUP = false;
    mocks.settings.events.NEW_ORG_CREATED = false;
    await service.notifyRegistration(registration);
    expect(createdTypes()).toEqual([]);
  });
});

describe('notifySystemError', () => {
  it('announces the first error and throttles the following ones', async () => {
    await service.notifySystemError({ message: 'boom', method: 'GET', path: '/x' });
    expect(createdTypes()).toEqual(['SYSTEM_ERROR']);

    mocks.redisSet.mockResolvedValue(null);
    await service.notifySystemError({ message: 'boom again' });
    expect(createdTypes()).toEqual(['SYSTEM_ERROR']);
  });

  it('respects the system-errors toggle', async () => {
    mocks.settings.events.SYSTEM_ERRORS = false;
    await service.notifySystemError({ message: 'boom' });
    expect(createdTypes()).toEqual([]);
  });
});
