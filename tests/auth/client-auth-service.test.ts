import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firstValueFrom, skip, take } from 'rxjs';
import { ClientAuthService } from '@/auth/client-auth-service';
import type { ClientAuthAdapter, AccessToken } from '@/auth/types';

function tok(name: string, token: string, expiresInSec = 3600): AccessToken {
  return { name, token, expiresAt: Date.now() + expiresInSec * 1000 };
}

function fakeAdapter(
  name: string,
  refresh: AccessToken | null = null,
): ClientAuthAdapter {
  return {
    name,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(refresh),
  };
}

describe('ClientAuthService', () => {
  it('throws on duplicate adapter names', () => {
    expect(() => new ClientAuthService([fakeAdapter('google'), fakeAdapter('google')]))
      .toThrow(/duplicate adapter name "google"/);
  });

  it('getAccessToken returns null and emits signed-out when no adapter has a session', async () => {
    const svc = new ClientAuthService([fakeAdapter('google')]);
    expect(await svc.getAccessToken()).toBeNull();
    const s = await firstValueFrom(svc.state$.pipe(take(1)));
    expect(s.status).toBe('signed-out');
  });

  it('getAccessToken refreshes against first successful adapter and emits signed-in', async () => {
    const a = fakeAdapter('google', tok('google', 'g-tok'));
    const svc = new ClientAuthService([a]);
    const t = await svc.getAccessToken();
    expect(t?.token).toBe('g-tok');
    expect(t?.name).toBe('google');
    expect(t?.expiresAt).toBeGreaterThan(Date.now());
    const s = await firstValueFrom(svc.state$.pipe(take(1)));
    expect(s).toEqual({ status: 'signed-in', name: 'google' });
  });

  it('getAccessToken caches within the leeway window', async () => {
    const a = fakeAdapter('google', tok('google', 'g-tok'));
    const svc = new ClientAuthService([a]);
    await svc.getAccessToken();
    await svc.getAccessToken();
    expect(a.refresh).toHaveBeenCalledTimes(1);
  });

  it('getAccessToken refreshes when cached token is within the leeway window', async () => {
    const a = fakeAdapter('google');
    (a.refresh as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(tok('google', 'g-tok-1', 60))
      .mockResolvedValueOnce(tok('google', 'g-tok-2'));
    const svc = new ClientAuthService([a]);
    const t1 = await svc.getAccessToken();
    const t2 = await svc.getAccessToken();
    expect(t1?.token).toBe('g-tok-1');
    expect(t2?.token).toBe('g-tok-2');
  });

  it('getAccessToken coalesces concurrent calls', async () => {
    const a = fakeAdapter('google');
    let resolveRefresh!: (v: AccessToken | null) => void;
    (a.refresh as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise<AccessToken | null>((r) => { resolveRefresh = r; }),
    );
    const svc = new ClientAuthService([a]);
    const p1 = svc.getAccessToken();
    const p2 = svc.getAccessToken();
    resolveRefresh(tok('google', 't'));
    const [t1, t2] = await Promise.all([p1, p2]);
    expect(t1).toBe(t2);
  });

  it('getAccessToken returns null when refresh fails', async () => {
    const a = fakeAdapter('google', null);
    const svc = new ClientAuthService([a]);
    expect(await svc.getAccessToken()).toBeNull();
    const s = await firstValueFrom(svc.state$.pipe(take(1)));
    expect(s.status).toBe('signed-out');
  });

  it('getAccessToken returns null when refresh throws', async () => {
    const a = fakeAdapter('google');
    (a.refresh as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    const svc = new ClientAuthService([a]);
    expect(await svc.getAccessToken()).toBeNull();
  });

  it('getAccessToken tries adapters in order and returns first success', async () => {
    const a = fakeAdapter('google', null);
    const b = fakeAdapter('dropbox', tok('dropbox', 'd-tok'));
    const svc = new ClientAuthService([a, b]);
    const t = await svc.getAccessToken();
    expect(t?.name).toBe('dropbox');
    expect(t?.token).toBe('d-tok');
  });

  it('supportedAuths().login calls adapter.login', async () => {
    const a = fakeAdapter('google');
    const svc = new ClientAuthService([a]);
    await svc.supportedAuths()[0].login();
    expect(a.login).toHaveBeenCalled();
  });

  it('supportedAuths returns name + login fn', () => {
    const svc = new ClientAuthService([fakeAdapter('google')]);
    const supported = svc.supportedAuths();
    expect(supported).toHaveLength(1);
    expect(supported[0].name).toBe('google');
    expect(typeof supported[0].login).toBe('function');
  });

  it('logout clears cache, calls adapter, emits signed-out', async () => {
    const a = fakeAdapter('google', tok('google', 'g-tok'));
    const svc = new ClientAuthService([a]);
    await svc.getAccessToken();
    await svc.logout();
    expect(a.logout).toHaveBeenCalled();
    const s = await firstValueFrom(svc.state$.pipe(take(1)));
    expect(s.status).toBe('signed-out');
  });

  it('logout tries all adapters when none is cached', async () => {
    const a = fakeAdapter('google');
    const b = fakeAdapter('dropbox');
    const svc = new ClientAuthService([a, b]);
    await svc.logout();
    expect(a.logout).toHaveBeenCalled();
    expect(b.logout).toHaveBeenCalled();
  });

  it('emits state changes via state$', async () => {
    const a = fakeAdapter('google', tok('google', 'g-tok'));
    const svc = new ClientAuthService([a]);
    const next = firstValueFrom(svc.state$.pipe(skip(1), take(1)));
    await svc.getAccessToken();
    const s = await next;
    expect(s).toEqual({ status: 'signed-in', name: 'google' });
  });
});