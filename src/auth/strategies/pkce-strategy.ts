import type { AuthStrategy, LoginRefreshResult } from './auth-strategy';
import type { FeatureCreds } from '../feature-handle';
import type { SecretStore } from '../secret-store';
import type { ProviderDefinition } from '../define-provider';

export type PkceStrategyConfig = {
  readonly providers: readonly ProviderDefinition[];
  readonly secretStore: SecretStore;
};

const NOT_IMPLEMENTED = 'PKCE strategy is not implemented yet (Phase E).';

/**
 * Stub for the PKCE (client-only) strategy. The strategy seam exists so a
 * real implementation can drop in without touching `AuthService` /
 * `FeatureHandle`. Today every method throws.
 */
export class PkceStrategy implements AuthStrategy {
  constructor(_config: PkceStrategyConfig) {}

  startLogin(_providerName: string): void {
    throw new Error(NOT_IMPLEMENTED);
  }

  async logout(): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async refreshLogin(): Promise<LoginRefreshResult | null> {
    throw new Error(NOT_IMPLEMENTED);
  }

  startFeature(_provider: string, _feature: string): void {
    throw new Error(NOT_IMPLEMENTED);
  }

  async refreshFeature(_provider: string, _refreshToken: string): Promise<FeatureCreds | null> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async revokeFeature(_provider: string, _token: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
