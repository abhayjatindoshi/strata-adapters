import type { StorageAdapter } from 'strata-data-sync';
import type { FeatureMap } from './feature-spec';
import type { AuthAdapter } from './auth-adapter';
import type { ProviderBrand } from './provider-brand';

/** Builds a cloud StorageAdapter from the active AuthAdapter. */
export type CloudFactory = (auth: AuthAdapter) => StorageAdapter;

/**
 * A configured provider — the framework-shipped value an app passes to
 * `defineStrata` (and the server `defineOAuthHandlers`).
 *
 * - `features` always includes any non-login OAuth grants the app cares about.
 * - If the provider supports login, `features.login` is present.
 * - If the provider is a login provider, `cloud` is a factory for the paired
 *   cloud StorageAdapter. Feature-only providers omit `cloud`.
 * - `brand` is optional visual assets consumed by `<LoginButton>`.
 */
export type ProviderModule = {
  readonly name: string;
  readonly label: string;
  readonly features: FeatureMap;
  readonly cloud?: CloudFactory;
  readonly brand?: ProviderBrand;
};
