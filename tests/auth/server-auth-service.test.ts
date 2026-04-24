import { describe, it, expect, vi } from 'vitest';
import { ServerAuthService } from '@strata-adapters/auth/server-auth-service';
import type { ServerAuthAdapter } from '@strata-adapters/auth/server-auth-adapter';

function adapter(name: string, paths: readonly string[]): ServerAuthAdapter {
  return {
    name,
    handle: vi.fn(async (_req: Request, path: string) => {
      if (paths.includes(path)) return new Response(`${name}:${path}`);
      return null;
    }),
  };
}

describe('ServerAuthService', () => {
  it('throws on duplicate adapter names', () => {
    const a: ServerAuthAdapter = { name: 'g', handle: async () => null };
    const b: ServerAuthAdapter = { name: 'g', handle: async () => null };
    expect(() => new ServerAuthService([a, b])).toThrow(/duplicate adapter name "g"/);
  });

  it('returns 404 when path is outside basePath', async () => {
    const svc = new ServerAuthService([adapter('g', ['/login'])], { basePath: '/api/auth' });
    const res = await svc.fetch(new Request('https://example.com/missing'));
    expect(res.status).toBe(404);
  });

  it('strips basePath and forwards relative path to adapter.handle', async () => {
    const a = adapter('g', ['/login']);
    const svc = new ServerAuthService([a], { basePath: '/api/auth' });
    const res = await svc.fetch(new Request('https://example.com/api/auth/login?provider=g'));
    expect(await res.text()).toBe('g:/login');
    expect(a.handle).toHaveBeenCalledWith(expect.any(Request), '/login');
  });

  it('walks adapters until one returns a response', async () => {
    const a = adapter('a', []);
    const b = adapter('b', ['/login']);
    const svc = new ServerAuthService([a, b]);
    const res = await svc.fetch(new Request('https://example.com/login'));
    expect(await res.text()).toBe('b:/login');
    expect(a.handle).toHaveBeenCalled();
    expect(b.handle).toHaveBeenCalled();
  });

  it('returns 404 when no adapter handles the request', async () => {
    const svc = new ServerAuthService([adapter('a', [])]);
    const res = await svc.fetch(new Request('https://example.com/foo'));
    expect(res.status).toBe(404);
  });

  it('treats a path equal to basePath as the empty relative path', async () => {
    const a = adapter('g', ['']);
    const svc = new ServerAuthService([a], { basePath: '/api/auth' });
    const res = await svc.fetch(new Request('https://example.com/api/auth'));
    expect(await res.text()).toBe('g:');
  });
});