import { BehaviorSubject, map } from 'rxjs';
import type { AuthAdapter, AuthState } from './auth-adapter';
import type { ProviderInfo } from './oauth-providers';
import { isSafeReturnUrl } from './oauth-utils';

export type AuthServiceState = {
  readonly status: 'loading' | 'authenticated' | 'unauthenticated';
  readonly provider?: string;
  readonly accessToken?: string;
  readonly expiresAt?: number;
};

export type FeatureCreds = {
  readonly provider: string;
  readonly feature: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly meta?: Record<string, unknown>;
};

export type AuthServiceConfig = {
  readonly sessionKey: string;
  readonly returnUrlKey: string;
  readonly featureCredsKey?: string;
  readonly providers?: readonly ProviderInfo[];
};

export class AuthService {
  private readonly authState$ = new BehaviorSubject<AuthServiceState>({ status: 'loading' });
  private readonly config: AuthServiceConfig;

  readonly state$ = this.authState$.asObservable();
  readonly providers: readonly ProviderInfo[];

  constructor(config: AuthServiceConfig) {
    this.config = config;
    this.providers = config.providers ?? [];
  }

  getState(): AuthServiceState {
    return this.authState$.getValue();
  }

  login(provider: string) {
    window.location.href = `/api/auth/login?provider=${provider}`;
  }

  async refresh(): Promise<string | null> {
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST' });

      if (!response.ok) {
        this.authState$.next({ status: 'unauthenticated' });
        return null;
      }

      const data = await response.json() as { access_token: string; expires_in: number; provider: string };
      const expiresAt = Date.now() + data.expires_in * 1000;

      this.authState$.next({
        status: 'authenticated',
        provider: data.provider,
        accessToken: data.access_token,
        expiresAt,
      });

      this.saveSession(data.provider, data.access_token, expiresAt);
      return data.access_token;
    } catch {
      this.authState$.next({ status: 'unauthenticated' });
      return null;
    }
  }

  async getAccessToken(): Promise<string | null> {
    const state = this.authState$.getValue();

    if (!state.accessToken || !state.expiresAt) return null;

    if (state.expiresAt - Date.now() < 5 * 60 * 1000) {
      return this.refresh();
    }

    return state.accessToken;
  }

  async logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    this.authState$.next({ status: 'unauthenticated' });
    this.clearSession();
  }

  async tryRestoreSession() {
    const cached = this.loadSession();
    if (cached && cached.expiresAt - Date.now() > 5 * 60 * 1000) {
      this.authState$.next({
        status: 'authenticated',
        provider: cached.provider,
        accessToken: cached.accessToken,
        expiresAt: cached.expiresAt,
      });
      return;
    }

    await this.refresh();
  }

  // --- Feature auth ---

  featureLogin(provider: string, feature: string) {
    this.saveReturnUrl();
    window.location.href = `/api/auth/login?provider=${provider}&feature=${feature}`;
  }

  saveFeatureCreds(creds: FeatureCreds) {
    const key = this.featureCredsKey();
    if (!key) return;
    sessionStorage.setItem(key, JSON.stringify(creds));
  }

  consumeFeatureCreds(): FeatureCreds | null {
    const key = this.featureCredsKey();
    if (!key) return null;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    sessionStorage.removeItem(key);
    try {
      return JSON.parse(raw) as FeatureCreds;
    } catch {
      return null;
    }
  }

  async refreshFeatureToken(provider: string, refreshToken: string): Promise<FeatureCreds | null> {
    try {
      const response = await fetch('/api/auth/feature/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, refresh_token: refreshToken }),
      });

      if (!response.ok) return null;

      const data = await response.json() as { access_token: string; refresh_token: string; expires_in: number };
      return {
        provider,
        feature: '',
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      };
    } catch {
      return null;
    }
  }

  async revokeFeatureToken(provider: string, token: string): Promise<void> {
    await fetch('/api/auth/feature/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, token }),
    });
  }

  // --- Return URL ---

  saveReturnUrl() {
    sessionStorage.setItem(this.config.returnUrlKey, window.location.pathname + window.location.search);
  }

  consumeReturnUrl(): string {
    const url = sessionStorage.getItem(this.config.returnUrlKey);
    sessionStorage.removeItem(this.config.returnUrlKey);
    if (!url || !isSafeReturnUrl(url)) return '/';
    return url;
  }

  // --- Auth adapter bridge ---

  toAuthAdapter(): AuthAdapter {
    return {
      state$: this.authState$.pipe(map(s => s.status)),
      getAccessToken: () => this.getAccessToken(),
    };
  }

  // --- Private helpers ---

  private saveSession(provider: string, accessToken: string, expiresAt: number) {
    sessionStorage.setItem(this.config.sessionKey, JSON.stringify({ provider, accessToken, expiresAt }));
  }

  private loadSession(): { provider: string; accessToken: string; expiresAt: number } | null {
    const raw = sessionStorage.getItem(this.config.sessionKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private clearSession() {
    sessionStorage.removeItem(this.config.sessionKey);
  }

  private featureCredsKey(): string | null {
    return this.config.featureCredsKey ?? null;
  }
}
