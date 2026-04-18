import type { FeatureCreds } from '../feature-handle';

export type LoginRefreshResult = {
  readonly provider: string;
  readonly accessToken: string;
  readonly expiresIn: number;
};

/**
 * Strategy seam for OAuth flow plumbing. `AuthService` and `FeatureHandle`
 * delegate all network/redirect calls here so the same surface can be backed
 * by either a BFF (server-mediated) or a PKCE (client-only) implementation.
 */
export type AuthStrategy = {
  /** Begin the login OAuth flow. */
  startLogin(providerName: string): void;

  /** End the login session (revoke + clear). */
  logout(): Promise<void>;

  /** Refresh the active login token. Returns null if no session. */
  refreshLogin(): Promise<LoginRefreshResult | null>;

  /** Begin a non-login OAuth grant flow. */
  startFeature(provider: string, feature: string): void;

  /** Refresh a non-login OAuth token using its refresh token. */
  refreshFeature(provider: string, refreshToken: string): Promise<FeatureCreds | null>;

  /** Revoke a non-login OAuth token. */
  revokeFeature(provider: string, token: string): Promise<void>;
};
