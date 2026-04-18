// Providers
export { StrataProvider } from './strata-provider';
export type { StrataProviderProps } from './strata-provider';
export { TenantProvider } from './tenant-provider';
export type { TenantProviderProps } from './tenant-provider';

// Context
export type { StrataContextValue, TenantContextValue } from './context';

// Guards (layout-route)
export { AuthGuard } from './guards/auth-guard';
export type { AuthGuardProps } from './guards/auth-guard';
export { TenantGuard } from './guards/tenant-guard';
export type { TenantGuardProps } from './guards/tenant-guard';

// Core hooks
export { useStrata } from './hooks/use-strata';
export { useAuth } from './hooks/use-auth';
export { useProviders } from './hooks/use-providers';
export { useLogin } from './hooks/use-login';
export { useTenant, useTenantList } from './hooks/use-tenant';
export { useSyncStatus, useDirtyState } from './hooks/use-sync-status';
export { useStrataError } from './hooks/use-strata-error';
export { useEncryption } from './hooks/use-encryption';
export { useRepo, useEntity, useQuery } from './hooks/use-repo';
export { useObservable } from './hooks/use-observable';

// Google Drive hooks
export {
  useGoogleCreateForm,
  useGoogleOpenForm,
  useGoogleFileBrowser,
} from './hooks/use-google-drive';
export type {
  GoogleCreateFormState,
  GoogleOpenFormState,
  GoogleFileBrowserState,
} from './hooks/use-google-drive';
