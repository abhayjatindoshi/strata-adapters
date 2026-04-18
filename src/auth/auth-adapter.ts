import type { Observable } from 'rxjs';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthState = {
  readonly status: AuthStatus;
  readonly provider?: string;
};

export type AuthAdapter = {
  readonly state$: Observable<AuthState>;
  getAccessToken(): Promise<string | null>;
  login(provider?: string): void;
  logout(): Promise<void>;
};
