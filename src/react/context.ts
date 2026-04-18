import { createContext } from 'react';
import type { Strata, Tenant } from 'strata-data-sync';
import type { AuthState } from '@strata-adapters/auth/auth-adapter';
import type { AuthService } from '@strata-adapters/auth/auth-service';
import type { ErrorBus } from '@strata-adapters/errors/error-bus';

export type StrataContextValue = {
  readonly strata: Strata | null;
  readonly authState: AuthState;
  readonly errorBus: ErrorBus | null;
  readonly authService: AuthService | null;
};

export const StrataContext = createContext<StrataContextValue>({
  strata: null,
  authState: { status: 'loading' },
  errorBus: null,
  authService: null,
});

export type TenantContextValue = {
  readonly tenant: Tenant | undefined;
  readonly loading: boolean;
  readonly error: Error | null;
};

export const TenantContext = createContext<TenantContextValue>({
  tenant: undefined,
  loading: false,
  error: null,
});
