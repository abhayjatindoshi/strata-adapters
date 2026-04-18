import {
  Strata,
  type StrataConfig as CoreStrataConfig,
  type EntityDefinition,
  type StrataOptions,
  type BlobMigration,
  type EncryptionService,
} from 'strata-data-sync';
import { LocalStorageAdapter } from '@strata-adapters/adapters/local-storage/local-storage';
import { withGzip } from '@strata-adapters/transforms/gzip';
import { withRetry } from '@strata-adapters/transforms/retry';
import { withErrorBroadcast } from '@strata-adapters/transforms/error-broadcast';
import { Pbkdf2EncryptionService } from '@strata-adapters/encryption/pbkdf2-service';
import { AesGcmEncryptionStrategy } from '@strata-adapters/encryption/strategy/aes-gcm-strategy';
import { ErrorBus } from '@strata-adapters/errors/error-bus';
import type { AuthAdapter } from '@strata-adapters/auth/auth-adapter';
import type { CloudFactory } from '@strata-adapters/auth/provider-module';
import type { EncryptionConfig } from './strata-config';
import { getOrCreateDeviceId } from './device-id';

export type CreateStrataInstanceConfig = {
  readonly auth: AuthAdapter;
  readonly cloud: CloudFactory;
  readonly appId: string;
  readonly deviceIdKey: string;
  readonly entities: ReadonlyArray<EntityDefinition<any>>;
  readonly encryption?: EncryptionConfig;
  readonly migrations?: ReadonlyArray<BlobMigration>;
  readonly options?: StrataOptions;
};

export type StrataInstance = {
  readonly strata: Strata;
  readonly errorBus: ErrorBus;
  readonly dispose: () => Promise<void>;
};

function isEncryptionService(value: unknown): value is EncryptionService {
  return (
    typeof value === 'object' &&
    value !== null &&
    'encrypt' in value &&
    'decrypt' in value &&
    'deriveKeys' in value
  );
}

function buildEncryption(config: EncryptionConfig | undefined): EncryptionService | undefined {
  if (!config) return undefined;
  if (isEncryptionService(config)) return config;
  return new Pbkdf2EncryptionService({
    targets: config.targets ?? ['cloud'],
    strategy: new AesGcmEncryptionStrategy(),
  });
}

export function createStrataInstance(config: CreateStrataInstanceConfig): StrataInstance {
  const { auth, cloud, appId, deviceIdKey, entities, encryption, migrations, options } = config;

  const deviceId = getOrCreateDeviceId(deviceIdKey);
  const errorBus = new ErrorBus();
  const localAdapter = new LocalStorageAdapter(appId);
  const rawCloud = cloud(auth);
  const cloudAdapter = withErrorBroadcast(withGzip(withRetry(rawCloud)), errorBus);
  const encryptionService = buildEncryption(encryption);

  const coreConfig: CoreStrataConfig = {
    appId,
    entities,
    localAdapter,
    cloudAdapter,
    deviceId,
    migrations,
    encryptionService,
    options,
  };

  const strata = new Strata(coreConfig);

  const dispose = async () => {
    await strata.dispose();
    errorBus.dispose();
  };

  return { strata, errorBus, dispose };
}
