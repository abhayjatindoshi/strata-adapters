import { AuthService } from './auth-service';
import type { FeatureCreds } from './auth-service';
import { createOAuthHandlers } from './oauth-handlers';
import type { OAuthHandlers, ServerProvider } from './oauth-handlers';
import type { ProviderConfig, ProviderInfo } from './oauth-providers';

export type AuthInitConfig = {
  readonly providers: readonly ProviderConfig[];
  readonly storage: {
    readonly sessionKey: string;
    readonly returnUrlKey: string;
    readonly cookieName: string;
    readonly featureCredsKey?: string;
    readonly csrfCookieName?: string;
  };
  readonly paths?: {
    readonly loginRedirect?: string;
    readonly featureCallback?: string;
    readonly errorRedirect?: string;
  };
};

export type AuthInit = {
  readonly providers: readonly ProviderInfo[];
  readonly service: AuthService;
  readonly handlers?: OAuthHandlers;
};

function isServerProvider(p: ProviderConfig): p is ServerProvider {
  return !!p.clientSecret && !!p.callbackUrl;
}

export function initAuth(config: AuthInitConfig): AuthInit {
  const providers = config.providers.map(p => ({ name: p.name, label: p.label }));

  const service = new AuthService({
    sessionKey: config.storage.sessionKey,
    returnUrlKey: config.storage.returnUrlKey,
    featureCredsKey: config.storage.featureCredsKey,
    providers,
  });

  const serverProvider = config.providers.find(isServerProvider);
  if (!serverProvider) return { providers, service };

  const handlers = createOAuthHandlers({
    cookieName: config.storage.cookieName,
    provider: serverProvider,
    csrfCookieName: config.storage.csrfCookieName,
    loginRedirectPath: config.paths?.loginRedirect,
    featureCallbackPath: config.paths?.featureCallback,
    errorRedirectPath: config.paths?.errorRedirect,
  });

  return { providers, service, handlers };
}

export type { FeatureCreds };
