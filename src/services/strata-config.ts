import type {
  EntityDefinition,
  StrataOptions,
  BlobMigration,
  EncryptionService,
} from 'strata-data-sync';
import type { ProviderModule } from '@strata-adapters/auth/provider-module';

export type EncryptionConfig =
  | EncryptionService
  | { readonly targets?: ReadonlyArray<'local' | 'cloud'> };

/** Per-app session storage keys. The framework namespaces them by appId in Phase C. */
export type StorageKeys = {
  readonly deviceId: string;
  readonly session: string;
  readonly returnUrl: string;
  readonly featureCreds: string;
};

export type StrataConfig = {
  readonly appId: string;
  readonly storageKeys: StorageKeys;
  readonly entities: ReadonlyArray<EntityDefinition<any>>;
  readonly providers: readonly ProviderModule[];
  readonly encryption?: EncryptionConfig;
  readonly migrations?: ReadonlyArray<BlobMigration>;
  readonly options?: StrataOptions;
};

export function defineStrata(config: StrataConfig): StrataConfig {
  return config;
}
