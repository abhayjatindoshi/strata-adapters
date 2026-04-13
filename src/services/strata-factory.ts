import {
  Strata,
  type StrataConfig,
  type EntityDefinition,
  type StrataOptions,
  type BlobMigration,
  type EncryptionService,
  type StorageAdapter,
} from 'strata-data-sync';
import { LocalStorageAdapter } from '@strata-adapters/adapters/local-storage/local-storage';
import { GoogleDriveAdapter } from '@strata-adapters/adapters/google-drive/google-drive';
import { withGzip } from '@strata-adapters/transforms/gzip';
import { withRetry } from '@strata-adapters/transforms/retry';
import { withErrorBroadcast } from '@strata-adapters/transforms/error-broadcast';
import { Pbkdf2EncryptionService } from '@strata-adapters/encryption/pbkdf2-service';
import { AesGcmEncryptionStrategy } from '@strata-adapters/encryption/strategy/aes-gcm-strategy';
import { ErrorBus } from '@strata-adapters/errors/error-bus';
import type { AuthAdapter } from '@strata-adapters/auth/auth-adapter';
import { getOrCreateDeviceId } from './device-id';

export type CloudProvider = 'google-drive';

export type StrataInitConfig = {
  readonly auth: AuthAdapter;
  readonly appId: string;
  readonly entities: ReadonlyArray<EntityDefinition<any>>;
  readonly cloudProvider: CloudProvider;
  readonly encryption?: {
    readonly targets?: ReadonlyArray<'local' | 'cloud'>;
  } | EncryptionService;
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

function createCloudAdapter(
  provider: CloudProvider,
  auth: AuthAdapter,
  errorBus: ErrorBus,
): StorageAdapter {
  const getToken = async () => {
    const token = await auth.getAccessToken();
    if (!token) throw new Error('No access token available');
    return token;
  };

  let adapter: StorageAdapter;
  switch (provider) {
    case 'google-drive':
      adapter = new GoogleDriveAdapter(getToken);
      break;
  }

  return withErrorBroadcast(withGzip(withRetry(adapter)), errorBus);
}

function createEncryptionService(
  config: StrataInitConfig['encryption'],
): EncryptionService | undefined {
  if (!config) return undefined;
  if (isEncryptionService(config)) return config;

  return new Pbkdf2EncryptionService({
    targets: config.targets ?? ['cloud'],
    strategy: new AesGcmEncryptionStrategy(),
  });
}

export function createStrataInstance(config: StrataInitConfig): StrataInstance {
  const { auth, appId, entities, cloudProvider, encryption, migrations, options } = config;

  const deviceId = getOrCreateDeviceId(appId);
  const localAdapter = new LocalStorageAdapter(appId);
  const errorBus = new ErrorBus();
  const cloudAdapter = createCloudAdapter(cloudProvider, auth, errorBus);
  const encryptionService = createEncryptionService(encryption);

  const strataConfig: StrataConfig = {
    appId,
    entities,
    localAdapter,
    cloudAdapter,
    deviceId,
    migrations,
    encryptionService,
    options,
  };

  const strata = new Strata(strataConfig);

  const dispose = async () => {
    await strata.dispose();
    errorBus.dispose();
  };

  return { strata, errorBus, dispose };
}
