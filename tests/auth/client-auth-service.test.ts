import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firstValueFrom, skip, take } from 'rxjs';
import { ClientAuthService } from '@strata-adapters/auth/client-auth-service';
import type { ClientAuthAdapter, AccessToken } from '@strata-adapters/auth/types';

const KEY = 'test_active_auth';
const OPTS = { activeAuthKey: KEY };

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, v); },
  } satisfies Storage;
}

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
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws on duplicate adapter names', () => {
    expect(() => new ClientAuthService([fakeAdapter('google'), fakeAdapter('google')], OPTS))
      .toThrow(/duplicate adapter name "google"/);
  });

  it('getAccessToken returns null and emits signed-out when no active is persisted', async () => {
    const svc = new ClientAuthService([fakeAdapter('google')], OPTS);
    expect(await svc.getAccessToken()).toBeNull();
    const s = await firstValueFrom(svc.state$.pipe(take(1)));
    expect(s.status).toBe('signed-out');
  });

  it('getAccessToken refreshes against persisted adapter and emits signed-in', async () => {
    localStorage.setItem(KEY, 'google');
    const a = fakeAdapter('google', tok('google', 'g-tok'));
    const svc = new ClientAuthService([a], OPTS);
    const t = await svc.getAccessToken();
    expect(t?.token).toBe('g-tok');
    expect(t?.name).toBe('google');
    expect(t?.expiresAt).toBeGreaterThan(Date.now());
    const s = await firstValueFrom(svc.state$.pipe(take(1)));
    expect(s).toEqual({ status: 'signed-in', name: 'google' });
  });

  it('getAccessToken caches within the leeway window', async () => {
    localStorage.setItem(KEY, 'google');
    const a = fakeAdapter('google', tok('google', 'g-tok'));
    const svc = new ClientAuthService([a], OPTS);
    await svc.getAccessToken();
    await svc.getAccessToken();
    expect(a.refresh).toHaveBeenCalledTimes(1);
  });

  it('getAccessToken refreshes when cached token is within the leeway window', async () => {
    localStorage.setItem(KEY, 'google');
    const a = fakeAdapter('google');
    (a.refresh as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(tok('google', 'g-tok-1', 60))
      .mockResolvedValueOnce(tok('google', 'g-tok-2'));
    const svc = new ClientAuthService([a], OPTS);
    const t1 = await svc.getAccessToken();
    const t2 = await svc.getAccessToken();
    expect(t1?.token).toBe('g-tok-1');
    expect(t2?.token).toBe('g-tok-2');
  });

  it('getAccessToken coalesces concurrent calls', async () => {
    localStorage.setItem(KEY, 'google');
    const a = fakeAdapter('google');
    let resolveRefresh!: (v: AccessToken | null) => void;
    (a.refresh as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise<AccessToken | null>((r) => { resolveRefresh = r; }),
    );
    const svc = new ClientAuthService([a], OPTS);
    const p1 = svc.getAccessToken();
    const p2 = svc.getAccessToken();
    resolveRefresh(tok('google', 't'));
    const [t1, t2] = await Promise.all([p1, p2]);
    expect(t1).toBe(t2);
  });

  it('getAccessToken returns null and clears persistence when refresh fails', async () => {
    localStorage.setItem(KEY, 'google');
    const a = fakeAdapter('google', null);
    const svc = new ClientAuthService([a], OPTS);
    expect(await svc.getAccessToken()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
    const s = await firstValueFrom(svc.state$.pipe(take(1)));
    expect(s.status).toBe('signed-out');
  });

  it('getAccessToken returns null when refresh throws', async () => {
    localStorage.setItem(KEY, 'google');
    const a = fakeAdapter('google');
    (a.refresh as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    const svc = new ClientAuthService([a], OPTS);
    expect(await svc.getAccessToken()).toBeNull();
  });

  it('supportedAuths().login persists name then calls adapter.login', async () => {
    const a = fakeAdapter('google');
    const svc = new ClientAuthService([a], OPTS);
    await svc.supportedAuths()[0].login();
    expect(localStorage.getItem(KEY)).toBe('google');
    expect(a.login).toHaveBeenCalled();
  });

  it('supportedAuths returns name + login fn', () => {
    const svc = new ClientAuthService([fakeAdapter('google')], OPTS);
    const supported = svc.supportedAuths();
    expect(supported).toHaveLength(1);
    expect(supported[0].name).toBe('google');
    expect(typeof supported[0].login).toBe('function');
  });

  it('logout clears cache + persistence, calls adapter, emits signed-out', async () => {
    localStorage.setItem(KEY, 'google');
    const a = fakeAdapter('google', tok('google', 'g-tok'));
    const svc = new ClientAuthService([a], OPTS);
    await svc.getAccessToken();
    await svc.logout();
    expect(a.logout).toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBeNull();
    const s = await firstValueFrom(svc.state$.pipe(take(1)));
    expect(s.status).toBe('signed-out');
  });

  it('logout is a no-op when nothing is active', async () => {
    const a = fakeAdapter('google');
    const svc = new ClientAuthService([a], OPTS);
    await svc.logout();
    expect(a.logout).not.toHaveBeenCalled();
  });

  it('setActive persists, clears cache, and emits signed-out (lazy refresh)', async () => {
    localStorage.setItem(KEY, 'google');
    const a = fakeAdapter('google', tok('google', 'g-tok'));
    const b = fakeAdapter('dropbox', tok('dropbox', 'd-tok'));
    const svc = new ClientAuthService([a, b], OPTS);
    await svc.getAccessToken();
    svc.setActive('dropbox');
    expect(localStorage.getItem(KEY)).toBe('dropbox');
    expect(b.refresh).not.toHaveBeenCalled();
    const t = await svc.getAccessToken();
    expect(t?.name).toBe('dropbox');
  });

  it('setActive throws on unknown adapter', () => {
    const svc = new ClientAuthService([fakeAdapter('google')], OPTS);
    expect(() => svc.setActive('missing')).toThrow(/unknown adapter "missing"/);
  });

  it('emits state changes via state$', async () => {
    localStorage.setItem(KEY, 'google');
    const a = fakeAdapter('google', tok('google', 'g-tok'));
    const svc = new ClientAuthService([a], OPTS);
    const next = firstValueFrom(svc.state$.pipe(skip(1), take(1)));
    await svc.getAccessToken();
    const s = await next;
    expect(s).toEqual({ status: 'signed-in', name: 'google' });
  });

  it('honours custom activeAuthKey', async () => {
    localStorage.setItem('my-key', 'google');
    const a = fakeAdapter('google', tok('google', 'g-tok'));
    const svc = new ClientAuthService([a], { activeAuthKey: 'my-key' });
    const t = await svc.getAccessToken();
    expect(t?.token).toBe('g-tok');
    await svc.logout();
    expect(localStorage.getItem('my-key')).toBeNull();
  });
});