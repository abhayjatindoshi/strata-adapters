import { describe, it, expect, vi } from 'vitest';
import { ServerAuthService } from '@/auth/server-auth-service';
import type { ServerAuthAdapter } from '@/auth/types';

const DEFAULT_OPTS = {
  basePath: '/api/auth',
  refreshCookieName: 'refresh',
  csrfCookieName: 'csrf',
  loginRedirectPath: '/',
  featureRedirectPath: '/',
  errorRedirectPath: '/error',
} as const;

function adapter(name: string): ServerAuthAdapter {
  return {
    name,
    scopes: { login: ['openid'] },
    login: vi.fn((_state: string, _feature: string) => `https://auth.example.com/login?provider=${name}`),
    exchangeCode: vi.fn(async () => ({ accessToken: 'tok', expiresIn: 3600 })),
    refresh: vi.fn(async () => ({ accessToken: 'tok2', expiresIn: 3600 })),
    logout: vi.fn(async () => {}),
  };
}

describe('ServerAuthService', () => {
  it('throws on duplicate adapter names', () => {
    const a = adapter('g');
    const b = adapter('g');
    expect(() => new ServerAuthService([a, b], DEFAULT_OPTS)).toThrow(/duplicate adapter name "g"/);
  });

  it('returns 404 when path is outside basePath', async () => {
    const svc = new ServerAuthService([adapter('g')], DEFAULT_OPTS);
    const res = await svc.fetch(new Request('https://example.com/missing'));
    expect(res.status).toBe(404);
  });

  it('routes /login to the correct adapter', async () => {
    const svc = new ServerAuthService([adapter('g')], DEFAULT_OPTS);
    const res = await svc.fetch(new Request('https://example.com/api/auth/login?provider=g'));
    // login returns a redirect
    expect(res.status).toBe(302);
  });

  it('returns 404 when provider is missing on /login', async () => {
    const svc = new ServerAuthService([adapter('a')], DEFAULT_OPTS);
    const res = await svc.fetch(new Request('https://example.com/api/auth/login'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when no matching route', async () => {
    const svc = new ServerAuthService([adapter('a')], DEFAULT_OPTS);
    const res = await svc.fetch(new Request('https://example.com/api/auth/foo'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for basePath root', async () => {
    const svc = new ServerAuthService([adapter('g')], DEFAULT_OPTS);
    const res = await svc.fetch(new Request('https://example.com/api/auth'));
    expect(res.status).toBe(404);
  });
});