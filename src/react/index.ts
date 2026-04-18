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

// Components
export { LoginButton } from './components/login-button';
export type { LoginButtonProps } from './components/login-button';
export { LoginButtons } from './components/login-buttons';
export type { LoginButtonsProps } from './components/login-buttons';
export type { LoginButtonTheme, LoginButtonBaseProps } from './components/provider-brand';
export type { ProviderBrand } from '@strata-adapters/auth/provider-brand';

// Core hooks
export { useStrata } from './hooks/use-strata';
export { useAuth } from './hooks/use-auth';
export { useProviders } from './hooks/use-providers';
export { useLogin } from './hooks/use-login';
export { useFeature } from './hooks/use-feature';
export { useTenant, useTenantList } from './hooks/use-tenant';
export { useSyncStatus, useDirtyState } from './hooks/use-sync-status';
export { useStrataError } from './hooks/use-strata-error';
export { useEncryption } from './hooks/use-encryption';
export { useRepo, useEntity, useQuery } from './hooks/use-repo';
export { useObservable } from './hooks/use-observable';

// Provider-specific hooks moved to provider folders:
//   import { useGoogleCreateForm } from 'strata-adapters/providers/google';
