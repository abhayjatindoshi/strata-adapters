import type { Observable } from 'rxjs';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthState = {
  readonly status: AuthStatus;
  readonly provider?: string;
};

/**
 * Minimal seam consumed by `strata-data-sync`-facing wiring (cloud adapters).
 * Apps interact with the richer `AuthService` for login/logout/feature grants.
 */
export type AuthAdapter = {
  readonly state$: Observable<AuthState>;
  getAccessToken(): Promise<string | null>;
};
