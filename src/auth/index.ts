export type { AccessToken, AuthState, AuthStateStatus, ClientAuthAdapter, ServerAuthAdapter, ServerAuthTokenResult, OAuthEndpoints } from './types';
export type { SupportedAuth, ClientAuthServiceOptions } from './client-auth-service';

export { ServerAuthService } from './server-auth-service';
export type { ServerAuthRegistration, ServerAuthServiceOptions } from './server-auth-service';

export { BffClientAdapter } from './bff-client-adapter';
export type { BffClientAdapterConfig } from './bff-client-adapter';
export { PkceClientAdapter } from './pkce-client-adapter';

export { BffServerAdapter } from './bff-server-adapter';
export type { BffServerAdapterConfig } from './bff-server-adapter';

export { ClientAuthService } from './client-auth-service';

export {
  generateState,
  parseState,
  jsonResponse,
  errorResponse,
  setCookieHeader,
  clearCookieHeader,
  getCookie,
  isSafeReturnUrl,
} from './oauth-utils';
export type { OAuthState } from './oauth-utils';