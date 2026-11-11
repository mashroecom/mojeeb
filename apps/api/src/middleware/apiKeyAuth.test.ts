import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/database', () => ({ prisma: {} }));
vi.mock('../services/planConfig.service', () => ({ planConfigService: {} }));

import type { Request } from 'express';
import {
  apiKeyRequestDenial,
  apiKeyRole,
  extractApiKey,
  hasAdminScope,
  hasWriteScope,
} from './apiKeyAuth';

const req = (headers: Record<string, string>) => ({ headers }) as unknown as Request;

describe('extractApiKey', () => {
  it('reads a key from the Authorization header', () => {
    expect(extractApiKey(req({ authorization: 'Bearer mj_abc123' }))).toBe('mj_abc123');
  });

  it('reads a key from the X-API-Key header', () => {
    expect(extractApiKey(req({ 'x-api-key': 'mj_abc123' }))).toBe('mj_abc123');
  });

  it('ignores session tokens and other schemes', () => {
    expect(extractApiKey(req({ authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig' }))).toBeNull();
    expect(extractApiKey(req({ authorization: 'Basic mj_abc123' }))).toBeNull();
    expect(extractApiKey(req({ 'x-api-key': 'something-else' }))).toBeNull();
    expect(extractApiKey(req({}))).toBeNull();
  });
});

describe('scopes', () => {
  it('write access needs write, admin or *', () => {
    expect(hasWriteScope(['read'])).toBe(false);
    expect(hasWriteScope([])).toBe(false);
    expect(hasWriteScope(['write'])).toBe(true);
    expect(hasWriteScope(['admin'])).toBe(true);
    expect(hasWriteScope(['*'])).toBe(true);
  });

  it('admin access needs admin or *', () => {
    expect(hasAdminScope(['read', 'write'])).toBe(false);
    expect(hasAdminScope(['admin'])).toBe(true);
    expect(hasAdminScope(['*'])).toBe(true);
  });
});

describe('apiKeyRole', () => {
  it('never grants owner-level permissions', () => {
    expect(apiKeyRole('OWNER', ['*'])).toBe('ADMIN');
    expect(apiKeyRole('OWNER', ['admin'])).toBe('ADMIN');
  });

  it('keeps the creator role when it is lower than admin', () => {
    expect(apiKeyRole('ADMIN', ['*'])).toBe('ADMIN');
    expect(apiKeyRole('MEMBER', ['*'])).toBe('MEMBER');
  });

  it('is member-level without the admin scope, whoever created the key', () => {
    expect(apiKeyRole('OWNER', ['read', 'write'])).toBe('MEMBER');
    expect(apiKeyRole('ADMIN', ['read'])).toBe('MEMBER');
  });
});

describe('apiKeyRequestDenial', () => {
  const key = { orgId: 'org_1', scopes: ['*'] };
  const base = '/api/v1/organizations/org_1';

  it("allows the key's own organization resources", () => {
    expect(apiKeyRequestDenial(key, 'GET', `${base}/agents`)).toBeNull();
    expect(apiKeyRequestDenial(key, 'POST', `${base}/knowledge-bases`)).toBeNull();
    expect(apiKeyRequestDenial(key, 'GET', base)).toBeNull();
  });

  it('refuses other organizations', () => {
    expect(apiKeyRequestDenial(key, 'GET', '/api/v1/organizations/org_2/agents')).toMatch(
      /own organization/,
    );
    // prefix of another id must not match
    expect(apiKeyRequestDenial(key, 'GET', '/api/v1/organizations/org_12/agents')).toMatch(
      /own organization/,
    );
  });

  it.each([
    '/api/v1/auth/me',
    '/api/v1/admin/users',
    '/api/v1/setup/status',
    '/api/v1/templates',
    '/api/v1/organizations',
    '/api/v1/organizations/',
    '/api/v2/organizations/org_1/agents',
    '/organizations/org_1/agents',
  ])('refuses %s', (path) => {
    expect(apiKeyRequestDenial(key, 'GET', path)).toMatch(/own organization/);
  });

  it('refuses API key management', () => {
    expect(apiKeyRequestDenial(key, 'GET', `${base}/api-keys`)).toMatch(/cannot be managed/);
    expect(apiKeyRequestDenial(key, 'POST', `${base}/api-keys`)).toMatch(/cannot be managed/);
    expect(apiKeyRequestDenial(key, 'DELETE', `${base}/api-keys/key_1`)).toMatch(
      /cannot be managed/,
    );
  });

  it('makes keys without a write scope read-only', () => {
    const readOnly = { orgId: 'org_1', scopes: ['read'] };
    expect(apiKeyRequestDenial(readOnly, 'GET', `${base}/agents`)).toBeNull();
    expect(apiKeyRequestDenial(readOnly, 'HEAD', `${base}/agents`)).toBeNull();
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
      expect(apiKeyRequestDenial(readOnly, method, `${base}/agents`)).toMatch(/read-only/);
    }
  });
});
