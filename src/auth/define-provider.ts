import type { CloudFactory, ProviderModule } from './provider-module';
import type { FeatureSpec, FeatureMap } from './feature-spec';
import type { ProviderBrand } from './provider-brand';
import { LOGIN_FEATURE } from './constants';
import {
  GOOGLE_OAUTH_ENDPOINTS,
  GOOGLE_DEFAULT_FEATURES,
  GOOGLE_CLOUD_FACTORY,
} from '@strata-adapters/providers/google/google-definition';
import { GOOGLE_BRAND } from '@strata-adapters/providers/google/google-brand';

/**
 * Generic OAuth endpoint shape used by `.oauth(...)` for non-bundled providers.
 */
export type OAuthEndpoints = {
  readonly authUrl: string;
  readonly tokenUrl: string;
  readonly revokeUrl: string;
};

/**
 * Server-side credentials. Apps reading these from runtime env (Cloudflare,
 * Node) supply them via `defineOAuthHandlers().providers(...)` not in the
 * shared provider definition.
 */
export type ProviderCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly callbackUrl: string;
};

/**
 * Build-time descriptor produced by `defineProvider(...)`. Holds everything
 * needed to register the provider on both server (resolves credentials) and
 * client (uses features + cloud factory).
 */
export type ProviderDefinition = ProviderModule & {
  readonly endpoints: OAuthEndpoints;
};

type FeatureName = string;

type State = {
  readonly name: string;
  endpoints?: OAuthEndpoints;
  features: FeatureMap;
  cloud?: CloudFactory;
  label?: string;
  brand?: ProviderBrand;
};

class CompletedBuilder {
  constructor(private readonly state: State) {}

  /** Override or replace the login feature scopes. */
  login(spec: FeatureSpec): CompletedBuilder {
    this.state.features = { ...this.state.features, [LOGIN_FEATURE]: spec };
    return this;
  }

  /** Add or override a non-login feature. The name "login" is rejected. */
  feature<N extends string>(
    name: N extends typeof LOGIN_FEATURE ? never : N,
    spec: FeatureSpec,
  ): CompletedBuilder {
    if (name === LOGIN_FEATURE) {
      throw new Error(`Use .login() to set the "${LOGIN_FEATURE}" feature.`);
    }
    this.state.features = { ...this.state.features, [name]: spec };
    return this;
  }

  /** Override the cloud factory (or set one for `.oauth()` providers). */
  cloud(factory: CloudFactory): CompletedBuilder {
    this.state.cloud = factory;
    return this;
  }

  /** Override the brand used by <LoginButton>. */
  brand(brand: ProviderBrand): CompletedBuilder {
    this.state.brand = brand;
    return this;
  }

  label(text: string): CompletedBuilder {
    this.state.label = text;
    return this;
  }

  build(): ProviderDefinition {
    if (!this.state.endpoints) {
      throw new Error(`Provider "${this.state.name}": no OAuth type chosen (call .google() / .oauth() / etc).`);
    }
    const hasLogin = !!this.state.features[LOGIN_FEATURE];
    if (hasLogin && !this.state.cloud) {
      throw new Error(`Provider "${this.state.name}" has a "${LOGIN_FEATURE}" feature but no cloud adapter. Call .cloud(...) or use a framework type that supplies one.`);
    }
    if (!hasLogin && this.state.cloud) {
      throw new Error(`Provider "${this.state.name}" has a cloud adapter but no "${LOGIN_FEATURE}" feature. Add .login({...}) or drop .cloud().`);
    }
    if (Object.keys(this.state.features).length === 0) {
      throw new Error(`Provider "${this.state.name}" has no features. Add .login({...}) or .feature("name", {...}).`);
    }
    return {
      name: this.state.name,
      label: this.state.label ?? humanize(this.state.name),
      features: this.state.features,
      cloud: this.state.cloud,
      brand: this.state.brand,
      endpoints: this.state.endpoints,
    };
  }
}

class TypeChooser {
  constructor(private readonly state: State) {}

  /** Use the bundled Google Drive provider — pre-filled OAuth + default scopes + Drive cloud + brand. */
  google(): CompletedBuilder {
    this.state.endpoints = GOOGLE_OAUTH_ENDPOINTS;
    this.state.features = { ...GOOGLE_DEFAULT_FEATURES };
    this.state.cloud = GOOGLE_CLOUD_FACTORY;
    this.state.brand = GOOGLE_BRAND;
    return new CompletedBuilder(this.state);
  }

  /** Custom OAuth provider — app supplies endpoints. No default scopes, cloud, or brand. */
  oauth(endpoints: OAuthEndpoints): CompletedBuilder {
    this.state.endpoints = endpoints;
    return new CompletedBuilder(this.state);
  }
}

/**
 * Begin defining a provider. The next call must be exactly one of the
 * type methods (.google() / .oauth() / ...).
 */
export function defineProvider(name: string): TypeChooser {
  return new TypeChooser({ name, features: {} });
}

function humanize(s: string): string {
  return s
    .split(/[-_\s]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}
