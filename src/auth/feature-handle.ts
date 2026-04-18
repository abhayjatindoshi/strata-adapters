import type { AuthStrategy } from './strategies/auth-strategy';

/** Credentials produced by an OAuth feature grant (non-login). */
export type FeatureCreds = {
  readonly provider: string;
  readonly feature: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly meta?: Record<string, unknown>;
};

export type FeatureHandleConfig = {
  readonly provider: string;
  readonly feature: string;
  readonly storageKey: string;
  readonly returnUrlKey: string;
  readonly strategy: AuthStrategy;
};

/**
 * Handle for a single (provider, feature) OAuth grant. Returned by
 * `AuthService.feature(provider, feature)`. Handles are cheap; create
 * fresh on demand.
 */
export class FeatureHandle {
  constructor(private readonly config: FeatureHandleConfig) {}

  /** Begin the OAuth grant flow. Saves current URL so the callback can return. */
  start(opts?: { readonly returnUrl?: string }): void {
    const returnUrl = opts?.returnUrl ?? window.location.pathname + window.location.search;
    sessionStorage.setItem(this.config.returnUrlKey, returnUrl);
    this.config.strategy.startFeature(this.config.provider, this.config.feature);
  }

  /** Called by the OAuth callback page to stash creds for the consumer. */
  deposit(creds: Omit<FeatureCreds, 'provider' | 'feature'>): void {
    const full: FeatureCreds = { provider: this.config.provider, feature: this.config.feature, ...creds };
    sessionStorage.setItem(this.storageKey(), JSON.stringify(full));
  }

  /** One-shot read by the consumer page. Returns null if not deposited. */
  consume(): FeatureCreds | null {
    const raw = sessionStorage.getItem(this.storageKey());
    if (!raw) return null;
    sessionStorage.removeItem(this.storageKey());
    try {
      return JSON.parse(raw) as FeatureCreds;
    } catch {
      return null;
    }
  }

  async refresh(refreshToken: string): Promise<FeatureCreds | null> {
    const result = await this.config.strategy.refreshFeature(this.config.provider, refreshToken);
    if (!result) return null;
    return { ...result, feature: this.config.feature };
  }

  async revoke(token: string): Promise<void> {
    await this.config.strategy.revokeFeature(this.config.provider, token);
  }

  private storageKey(): string {
    return `${this.config.storageKey}:${this.config.provider}:${this.config.feature}`;
  }
}

