import type { ProviderDefinition } from './define-provider';
import { createOAuthHandlers, type OAuthHandlers, type ProviderMap, type ServerProvider } from './oauth-handlers';
import { errorResponse } from './oauth-utils';

/** Resolves runtime credentials for a provider from the request env. */
export type CredentialResolver = (
  provider: ProviderDefinition,
  env: Record<string, string>,
) => { readonly clientId: string; readonly clientSecret: string; readonly callbackUrl: string };

/**
 * Default credential resolver: reads `${NAME_UPPER}_CLIENT_ID`,
 * `${NAME_UPPER}_CLIENT_SECRET`, `${NAME_UPPER}_CALLBACK_URL` from env.
 */
export const defaultCredentialResolver: CredentialResolver = (provider, env) => {
  const upper = provider.name.toUpperCase().replace(/-/g, '_');
  return {
    clientId: env[`${upper}_CLIENT_ID`],
    clientSecret: env[`${upper}_CLIENT_SECRET`],
    callbackUrl: env[`${upper}_CALLBACK_URL`],
  };
};

type Route = {
  readonly method: string;
  readonly path: string;
  readonly pick: (h: OAuthHandlers) => (request: Request) => Promise<Response>;
};

/**
 * Phase D will introduce strategy-specific routes. For now: the BFF route
 * table exposed by `createOAuthHandlers`.
 */
const BFF_ROUTES: readonly Route[] = [
  { method: 'GET',  path: '/api/auth/login',            pick: (h) => h.handleLogin },
  { method: 'GET',  path: '/api/auth/callback',         pick: (h) => h.handleCallback },
  { method: 'POST', path: '/api/auth/refresh',          pick: (h) => h.handleRefresh },
  { method: 'POST', path: '/api/auth/logout',           pick: (h) => h.handleLogout },
  { method: 'GET',  path: '/api/auth/feature/login',    pick: (h) => h.handleLogin },
  { method: 'GET',  path: '/api/auth/feature/callback', pick: (h) => h.handleCallback },
  { method: 'POST', path: '/api/auth/feature/refresh',  pick: (h) => h.handleFeatureRefresh },
  { method: 'POST', path: '/api/auth/feature/revoke',   pick: (h) => h.handleFeatureRevoke },
];

class FinalBuilder<Env> {
  constructor(
    private readonly appId: string,
    private readonly providers: readonly ProviderDefinition[],
    private resolver: CredentialResolver = defaultCredentialResolver,
  ) {}

  /** Override how runtime credentials are resolved per provider. */
  credentials(resolver: CredentialResolver): FinalBuilder<Env> {
    this.resolver = resolver;
    return this;
  }

  build(): (context: { request: Request; env: Env }) => Promise<Response> {
    const { providers, resolver, appId } = this;
    const cookieName = `${appId}_refresh`;

    return async (context) => {
      const { request, env } = context;
      const url = new URL(request.url);
      const route = BFF_ROUTES.find((r) => r.method === request.method && r.path === url.pathname);
      if (!route) return errorResponse('Not found', 404);

      try {
        const map = buildProviderMap(providers, resolver, env as Record<string, string>);
        const handlers = createOAuthHandlers({ cookieName, providers: map });
        return await route.pick(handlers)(request);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return errorResponse(message, 500);
      }
    };
  }
}

class ProviderChooser<Env> {
  constructor(private readonly appId: string) {}

  /** Register the providers (must be `defineProvider(...)` results). */
  providers(defs: readonly ProviderDefinition[]): FinalBuilder<Env> {
    return new FinalBuilder<Env>(this.appId, defs);
  }
}

/**
 * Define a Cloudflare Pages / Workers OAuth handler for the BFF strategy.
 * Returned function matches the `PagesFunction<Env>` signature.
 */
export function defineOAuthHandlers<Env = unknown>(appId: string): ProviderChooser<Env> {
  return new ProviderChooser<Env>(appId);
}

function buildProviderMap(
  providers: readonly ProviderDefinition[],
  resolver: CredentialResolver,
  env: Record<string, string>,
): ProviderMap {
  const out: Record<string, ServerProvider> = {};
  for (const def of providers) {
    const creds = resolver(def, env);
    out[def.name] = {
      name: def.name,
      authUrl: def.endpoints.authUrl,
      tokenUrl: def.endpoints.tokenUrl,
      revokeUrl: def.endpoints.revokeUrl,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      callbackUrl: creds.callbackUrl,
      features: def.features,
    };
  }
  return out;
}
