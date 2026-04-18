import type { EntityDefinition, StrataOptions, BlobMigration } from 'strata-data-sync';
import type { ProviderDefinition } from '@strata-adapters/auth/define-provider';
import type { AuthAdapter } from '@strata-adapters/auth/auth-adapter';
import type { ProviderModule } from '@strata-adapters/auth/provider-module';
import type { StorageAdapter } from 'strata-data-sync';
import type { StrataConfig, EncryptionConfig, StorageKeys } from './strata-config';

type AuthChoice =
  | { readonly kind: 'bff'; readonly providers: readonly ProviderDefinition[] }
  | { readonly kind: 'custom'; readonly adapter: AuthAdapter; readonly cloud: StorageAdapter | null }
  | { readonly kind: 'none' };

type StorageChoice =
  | { readonly kind: 'fromProvider' }
  | { readonly kind: 'custom'; readonly adapter: StorageAdapter }
  | { readonly kind: 'local' };

type Extras = {
  readonly encryption?: EncryptionConfig;
  readonly migrations?: ReadonlyArray<BlobMigration>;
  readonly options?: StrataOptions;
  readonly storageKeys?: Partial<StorageKeys>;
};

type State = {
  readonly appId: string;
  entities?: ReadonlyArray<EntityDefinition<any>>;
  auth?: AuthChoice;
  storage?: StorageChoice;
  extras?: Extras;
};

class FinalBuilder {
  constructor(private readonly state: State) {}

  extras(extras: Extras): FinalBuilder {
    this.state.extras = { ...this.state.extras, ...extras };
    return this;
  }

  build(): StrataConfig {
    if (!this.state.entities) throw new Error('defineStrata: missing .entities([...])');
    if (!this.state.auth) throw new Error('defineStrata: missing .auth.{bff|custom|none}(...)');
    if (!this.state.storage) throw new Error('defineStrata: missing .storage.{fromProvider|custom|local}()');

    validateCombination(this.state.auth, this.state.storage);

    const providers = providersForConfig(this.state.auth);
    const storageKeys = resolveStorageKeys(this.state.appId, this.state.extras?.storageKeys);

    return {
      appId: this.state.appId,
      storageKeys,
      entities: this.state.entities,
      providers,
      encryption: this.state.extras?.encryption,
      migrations: this.state.extras?.migrations,
      options: this.state.extras?.options,
    };
  }
}

class StorageChooser {
  constructor(private readonly state: State) {}

  fromProvider(): FinalBuilder {
    this.state.storage = { kind: 'fromProvider' };
    return new FinalBuilder(this.state);
  }

  custom(adapter: StorageAdapter): FinalBuilder {
    this.state.storage = { kind: 'custom', adapter };
    return new FinalBuilder(this.state);
  }

  local(): FinalBuilder {
    this.state.storage = { kind: 'local' };
    return new FinalBuilder(this.state);
  }
}

class AuthChooser {
  constructor(private readonly state: State) {}

  /** Server-mediated login (BFF). Requires a Cloudflare/Node server hosting `defineOAuthHandlers`. */
  bff(providers: readonly ProviderDefinition[]): { storage: StorageChooser } {
    this.state.auth = { kind: 'bff', providers };
    return { storage: new StorageChooser(this.state) };
  }

  /** Bring-your-own auth (Firebase, Auth0, in-house). */
  custom(adapter: AuthAdapter, opts?: { readonly cloud?: StorageAdapter }): { storage: StorageChooser } {
    this.state.auth = { kind: 'custom', adapter, cloud: opts?.cloud ?? null };
    return { storage: new StorageChooser(this.state) };
  }

  /** Local-only / single-device app. No login. */
  none(): { storage: StorageChooser } {
    this.state.auth = { kind: 'none' };
    return { storage: new StorageChooser(this.state) };
  }
}

class EntitiesChooser {
  constructor(private readonly state: State) {}

  entities(defs: ReadonlyArray<EntityDefinition<any>>): { auth: AuthChooser } {
    this.state.entities = defs;
    return { auth: new AuthChooser(this.state) };
  }
}

/** Begin building a Strata configuration. `appId` namespaces local storage and cookies. */
export function defineStrata(appId: string): EntitiesChooser {
  return new EntitiesChooser({ appId });
}

function providersForConfig(auth: AuthChoice): readonly ProviderModule[] {
  if (auth.kind === 'bff') return auth.providers;
  return [];
}

function validateCombination(auth: AuthChoice, storage: StorageChoice): void {
  if (storage.kind === 'fromProvider' && auth.kind !== 'bff') {
    throw new Error('.storage.fromProvider() requires .auth.bff(...) (PKCE deferred). Use .storage.custom() or .storage.local() with .auth.custom()/.none().');
  }
}

function resolveStorageKeys(appId: string, override: Partial<StorageKeys> | undefined): StorageKeys {
  const defaults: StorageKeys = {
    deviceId: `${appId}_device_id`,
    session: `${appId}_session`,
    returnUrl: `${appId}_return_url`,
    featureCreds: `${appId}_feature_creds`,
  };
  return { ...defaults, ...override };
}
