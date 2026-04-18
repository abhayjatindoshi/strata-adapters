export { getOrCreateDeviceId } from './device-id';
export { createStrataInstance } from './strata-factory';
export type { CreateStrataInstanceConfig, StrataInstance } from './strata-factory';
export { defineStrata } from './define-strata';
export type {
  StrataConfig,
  StorageKeys,
  EncryptionConfig,
} from './strata-config';
export { createSyncStatus$, createDirtyState$ } from './sync-status';
export type { SyncStatus } from './sync-status';
export { validateGoogleDriveMeta } from './tenant-meta';
export type { GoogleDriveSpace, GoogleDriveTenantMeta } from './tenant-meta';
