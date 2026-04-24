import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { BffClientAdapter } from '@strata-adapters/auth/bff-client-adapter';

const PREFIX = '/api/auth';
const REFRESH_URL = `${PREFIX}/refresh?provider=google`;
const LOGOUT_URL = `${PREFIX}/logout?provider=google`;
const LOGIN_URL = `${PREFIX}/login?provider=google`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function newAdapter() {
  return new BffClientAdapter({ name: 'google', label: 'Google', prefix: PREFIX });
}

describe('BffClientAdapter', () => {
  let mockFetch: Mock;
  let mockLocation: { href: string };

  beforeEach(() => {
    mockFetch = vi.fn();
    mockLocation = { href: '' };
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('window', { location: mockLocation });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes name and label', () => {
    const a = newAdapter();
    expect(a.name).toBe('google');
    expect(a.label).toBe('Google');
  });

  it('refresh posts to /refresh?provider=… and returns a tagged AccessToken', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ access_token: 'tok-1', expires_in: 3600 }),
    );
    const a = newAdapter();
    const r = await a.refresh();
    expect(mockFetch).toHaveBeenCalledWith(REFRESH_URL, { method: 'POST' });
    expect(r).toEqual({
      name: 'google',
      token: 'tok-1',
      expiresAt: expect.any(Number),
    });
    expect(r?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('refresh returns null on non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect(await newAdapter().refresh()).toBeNull();
  });

  it('refresh returns null on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('network'));
    expect(await newAdapter().refresh()).toBeNull();
  });

  it('refresh returns null on malformed JSON body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }));
    expect(await newAdapter().refresh()).toBeNull();
  });

  it('logout posts to /logout?provider=…', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await newAdapter().logout();
    expect(mockFetch).toHaveBeenCalledWith(LOGOUT_URL, { method: 'POST' });
  });

  it('logout swallows network errors', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('network'));
    await expect(newAdapter().logout()).resolves.toBeUndefined();
  });

  it('login navigates to /login?provider=…', () => {
    void newAdapter().login();
    expect(mockLocation.href).toBe(LOGIN_URL);
  });

  it('strips a trailing slash from prefix', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ access_token: 'tok-1', expires_in: 3600 }),
    );
    const a = new BffClientAdapter({ name: 'google', label: 'Google', prefix: '/api/auth/' });
    await a.refresh();
    expect(mockFetch).toHaveBeenCalledWith(REFRESH_URL, { method: 'POST' });
  });

  it('url-encodes the provider name in the query string', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ access_token: 'tok-1', expires_in: 3600 }),
    );
    const a = new BffClientAdapter({ name: 'oauth/edge', label: 'X', prefix: PREFIX });
    await a.refresh();
    expect(mockFetch).toHaveBeenCalledWith(
      `${PREFIX}/refresh?provider=oauth%2Fedge`,
      { method: 'POST' },
    );
  });
});