import type { AuthStrategy, LoginRefreshResult } from './auth-strategy';
import type { FeatureCreds } from '../feature-handle';

/**
 * BFF (server-mediated) strategy. All network calls hit the app's
 * `/api/auth/*` endpoints set up by `defineOAuthHandlers`.
 */
export class BffStrategy implements AuthStrategy {
  startLogin(providerName: string): void {
    window.location.href = `/api/auth/login?provider=${encodeURIComponent(providerName)}`;
  }

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
  }

  async refreshLogin(): Promise<LoginRefreshResult | null> {
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST' });
      if (!response.ok) return null;
      const data = (await response.json()) as { access_token: string; expires_in: number; provider: string };
      return { provider: data.provider, accessToken: data.access_token, expiresIn: data.expires_in };
    } catch {
      return null;
    }
  }

  startFeature(provider: string, feature: string): void {
    const params = new URLSearchParams({ provider, feature });
    window.location.href = `/api/auth/feature/login?${params.toString()}`;
  }

  async refreshFeature(provider: string, refreshToken: string): Promise<FeatureCreds | null> {
    const response = await fetch('/api/auth/feature/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, refresh_token: refreshToken }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { access_token: string; refresh_token: string; expires_in: number };
    return {
      provider,
      feature: '',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async revokeFeature(provider: string, token: string): Promise<void> {
    await fetch('/api/auth/feature/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, token }),
    });
  }
}
