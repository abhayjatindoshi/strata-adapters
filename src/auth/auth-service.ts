import { BehaviorSubject, distinctUntilChanged, map, type Observable } from 'rxjs';
import type { AuthAdapter, AuthState } from './auth-adapter';
import type { ProviderModule } from './provider-module';
import { FeatureHandle } from './feature-handle';
import { LOGIN_FEATURE } from './constants';
import { isSafeReturnUrl } from './oauth-utils';

type InternalState = AuthState & {
  readonly accessToken?: string;
  readonly expiresAt?: number;
};

type Session = { readonly provider: string; readonly accessToken: string; readonly expiresAt: number };

export type AuthServiceConfig = {
  readonly providers: readonly ProviderModule[];
  readonly sessionKey: string;
  readonly returnUrlKey: string;
  readonly featureCredsKey: string;
};

const REFRESH_LEEWAY_MS = 5 * 60 * 1000;

/**
 * The single per-app auth service. Implements `AuthAdapter` (consumed by
 * cloud adapters via the active provider). App code uses the broader API
 * directly: provider list, login/logout, and per-feature handles.
 */
export class AuthService implements AuthAdapter {
  private readonly internal$ = new BehaviorSubject<InternalState>({ status: 'loading' });
  readonly providers: readonly ProviderModule[];
  readonly state$: Observable<AuthState>;

  constructor(private readonly config: AuthServiceConfig) {
    this.providers = config.providers;
    this.state$ = this.internal$.pipe(
      map(({ status, provider }): AuthState => ({ status, provider })),
      distinctUntilChanged((a, b) => a.status === b.status && a.provider === b.provider),
    );
  }

  getState(): AuthState {
    const { status, provider } = this.internal$.getValue();
    return { status, provider };
  }

  /** Begin login on a provider (must be a registered login provider). */
  start(providerName: string): void {
    if (!this.findLoginProvider(providerName)) {
      throw new Error(`Unknown or non-login provider: ${providerName}`);
    }
    window.location.href = `/api/auth/login?provider=${encodeURIComponent(providerName)}`;
  }

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
    this.internal$.next({ status: 'unauthenticated' });
    sessionStorage.removeItem(this.config.sessionKey);
  }

  /** AuthAdapter: returns access token for the active login provider. */
  async getAccessToken(): Promise<string | null> {
    const state = this.internal$.getValue();
    if (!state.accessToken || !state.expiresAt) return null;
    if (state.expiresAt - Date.now() < REFRESH_LEEWAY_MS) return this.refresh();
    return state.accessToken;
  }

  /** Refresh the active login token. */
  async refresh(): Promise<string | null> {
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST' });
      if (!response.ok) {
        this.internal$.next({ status: 'unauthenticated' });
        return null;
      }
      const data = (await response.json()) as { access_token: string; expires_in: number; provider: string };
      const expiresAt = Date.now() + data.expires_in * 1000;
      this.internal$.next({ status: 'authenticated', provider: data.provider, accessToken: data.access_token, expiresAt });
      this.saveSession({ provider: data.provider, accessToken: data.access_token, expiresAt });
      return data.access_token;
    } catch {
      this.internal$.next({ status: 'unauthenticated' });
      return null;
    }
  }

  /** Hydrate from sessionStorage; falls back to cookie-based refresh. */
  async tryRestoreSession(): Promise<void> {
    const cached = this.loadSession();
    if (cached && cached.expiresAt - Date.now() > REFRESH_LEEWAY_MS) {
      this.internal$.next({ status: 'authenticated', provider: cached.provider, accessToken: cached.accessToken, expiresAt: cached.expiresAt });
      return;
    }
    await this.refresh();
  }

  /** Get a handle for a non-login OAuth grant on a provider. */
  feature(providerName: string, feature: string): FeatureHandle {
    if (feature === LOGIN_FEATURE) {
      throw new Error(`Use start() / logout() / getAccessToken() for "${LOGIN_FEATURE}". feature() is for non-login grants.`);
    }
    const provider = this.providers.find((p) => p.name === providerName);
    if (!provider) throw new Error(`Unknown provider: ${providerName}`);
    if (!provider.features[feature]) throw new Error(`Provider "${providerName}" has no feature "${feature}"`);
    return new FeatureHandle({
      provider: providerName,
      feature,
      storageKey: this.config.featureCredsKey,
      returnUrlKey: this.config.returnUrlKey,
    });
  }

  saveReturnUrl(): void {
    sessionStorage.setItem(this.config.returnUrlKey, window.location.pathname + window.location.search);
  }

  consumeReturnUrl(): string {
    const url = sessionStorage.getItem(this.config.returnUrlKey);
    sessionStorage.removeItem(this.config.returnUrlKey);
    if (!url || !isSafeReturnUrl(url)) return '/';
    return url;
  }

  private findLoginProvider(name: string): ProviderModule | undefined {
    return this.providers.find((p) => p.name === name && !!p.features[LOGIN_FEATURE]);
  }

  private saveSession(s: Session): void {
    sessionStorage.setItem(this.config.sessionKey, JSON.stringify(s));
  }

  private loadSession(): Session | null {
    const raw = sessionStorage.getItem(this.config.sessionKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }
}

