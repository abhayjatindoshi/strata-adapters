import type {
  EntityDefinition,
  StrataOptions,
  BlobMigration,
  EncryptionService,
  StorageAdapter,
} from 'strata-data-sync';
import type { AuthAdapter } from '@strata-adapters/auth/auth-adapter';

export type AuthFactory = () => AuthAdapter;
export type CloudFactory = (auth: AuthAdapter) => StorageAdapter;

export type ProviderRegistration = {
  readonly auth: AuthFactory;
  readonly cloud?: CloudFactory;
};

export type EncryptionConfig =
  | EncryptionService
  | { readonly targets?: ReadonlyArray<'local' | 'cloud'> };

export type StrataConfig = {
  readonly appId: string;
  readonly deviceIdKey: string;
  readonly entities: ReadonlyArray<EntityDefinition<any>>;
  readonly providers: Readonly<Record<string, ProviderRegistration>>;
  readonly encryption?: EncryptionConfig;
  readonly migrations?: ReadonlyArray<BlobMigration>;
  readonly options?: StrataOptions;
};

export function defineStrata(config: StrataConfig): StrataConfig {
  return config;
}
