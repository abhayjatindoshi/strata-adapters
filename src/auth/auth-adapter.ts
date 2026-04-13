import type { Observable } from 'rxjs';

export type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthAdapter = {
  readonly state$: Observable<AuthState>;
  getAccessToken(): Promise<string | null>;
};
