import type { AccessToken, ClientAuthAdapter } from './types';

export type BffClientAdapterConfig = {
  /** Provider name. Must match the matching `BffServerAdapter`'s `name`. */
  readonly name: string;
  /**
   * Shared URL prefix where the BFF endpoints are mounted. The adapter
   * appends `/login`, `/refresh`, `/logout` and adds `?provider={name}` as
   * a query parameter. The IdP callback (`/callback`) is invoked by the
   * IdP redirect, not by this client.
   *
   * Example: `prefix: '/api/auth'` →
   *   `POST /api/auth/refresh?provider=google`, etc.
   */
  readonly prefix: string;
};

/**
 * BFF (server-mediated) client adapter. Stateless protocol shell — calls
 * the routes mounted by the matching `BffServerAdapter`. The owning
 * `ClientAuthService` handles caching, leeway, inflight coalescing, and
 * branding the returned token.
 *
 * Per PLUGGABLES_V2 §3.
 */
export class BffClientAdapter implements ClientAuthAdapter {
  readonly name: string;
  private readonly prefix: string;

  constructor(config: BffClientAdapterConfig) {
    this.name = config.name;
    this.prefix = config.prefix.replace(/\/+$/, '');
  }

  /**
   * Begins the BFF login flow by navigating the page to
   * `${prefix}/login?provider={name}`. Resolves never — the page is
   * unloaded by the redirect.
   */
  async login(): Promise<void> {
    window.location.href = this.url('/login');
    await new Promise<void>(() => {
      /* never resolves; page is navigating away */
    });
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${this.prefix}/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      /* best-effort */
    }
  }

  async refresh(): Promise<AccessToken | null> {
    try {
      const response = await fetch(`${this.prefix}/refresh`, { method: 'POST', credentials: 'include' });
      if (!response.ok) return null;
      const data = (await response.json()) as { access_token?: unknown; expires_in?: unknown; name?: unknown };
      if (typeof data.access_token !== 'string' || typeof data.expires_in !== 'number') {
        return null;
      }
      return {
        name: typeof data.name === 'string' ? data.name : this.name,
        token: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };
    } catch {
      return null;
    }
  }

  private url(path: string): string {
    return `${this.prefix}${path}?provider=${encodeURIComponent(this.name)}`;
  }
}
