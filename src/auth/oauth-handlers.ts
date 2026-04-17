import type { ProviderConfig } from './oauth-providers';
import { exchangeCode, refreshAccessToken } from './oauth-providers';
import {
  generateState,
  parseState,
  jsonResponse,
  errorResponse,
  setCookieHeader,
  clearCookieHeader,
  getCookie,
  encodeRefreshCookie,
  decodeRefreshCookie,
} from './oauth-utils';

export type OAuthHandlersConfig = {
  readonly cookieName: string;
  readonly provider: ServerProvider;
  readonly csrfCookieName?: string;
  readonly loginRedirectPath?: string;
  readonly featureCallbackPath?: string;
  readonly errorRedirectPath?: string;
};

export type ServerProvider = ProviderConfig & {
  readonly clientSecret: string;
  readonly callbackUrl: string;
};

export type OAuthHandlers = {
  readonly handleLogin: (request: Request) => Promise<Response>;
  readonly handleCallback: (request: Request) => Promise<Response>;
  readonly handleRefresh: (request: Request) => Promise<Response>;
  readonly handleLogout: (request: Request) => Promise<Response>;
  readonly handleFeatureRefresh: (request: Request) => Promise<Response>;
  readonly handleFeatureRevoke: (request: Request) => Promise<Response>;
};

const CSRF_MAX_AGE = 600; // 10 minutes

export function createOAuthHandlers(config: OAuthHandlersConfig): OAuthHandlers {
  const {
    cookieName,
    provider,
    csrfCookieName = 'oauth_csrf',
    loginRedirectPath = '/',
    featureCallbackPath = '/auth/feature/callback',
    errorRedirectPath = '/login?error=auth_failed',
  } = config;

  function redirect(path: string): Response {
    return new Response(null, { status: 302, headers: { Location: path } });
  }

  async function handleLogin(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const providerName = url.searchParams.get('provider');
    if (!providerName) return errorResponse('Missing provider parameter');

    const feature = url.searchParams.get('feature') ?? 'login';
    const scopes = provider.scopes[feature];
    if (!scopes) return errorResponse(`Unsupported feature: ${feature}`);

    const state = generateState(providerName, feature);
    const csrf = JSON.parse(atob(state)).csrf as string;

    const authUrl = new URL(provider.authUrl);
    authUrl.searchParams.set('client_id', provider.clientId);
    authUrl.searchParams.set('redirect_uri', provider.callbackUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    return new Response(null, {
      status: 302,
      headers: {
        Location: authUrl.toString(),
        'Set-Cookie': setCookieHeader(csrfCookieName, csrf, CSRF_MAX_AGE),
      },
    });
  }

  async function handleCallback(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');

    if (oauthError || !code || !stateParam) {
      return redirect(errorRedirectPath);
    }

    let state: ReturnType<typeof parseState>;
    try {
      state = parseState(stateParam);
    } catch {
      return redirect(errorRedirectPath);
    }

    // Validate CSRF
    const csrfCookie = getCookie(request, csrfCookieName);
    if (!csrfCookie || csrfCookie !== state.csrf) {
      return redirect(errorRedirectPath);
    }

    let tokenResponse;
    try {
      tokenResponse = await exchangeCode(code, provider);
    } catch {
      return redirect(errorRedirectPath);
    }

    const clearCsrf = setCookieHeader(csrfCookieName, '', 0);

    if (state.feature !== 'login') {
      const fragment = new URLSearchParams({
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token || '',
        expires_in: String(tokenResponse.expires_in),
        provider: state.provider,
        feature: state.feature,
      });

      return new Response(null, {
        status: 302,
        headers: {
          Location: `${featureCallbackPath}#${fragment.toString()}`,
          'Set-Cookie': clearCsrf,
        },
      });
    }

    if (!tokenResponse.refresh_token) {
      return redirect(errorRedirectPath);
    }

    const cookieValue = encodeRefreshCookie(state.provider, tokenResponse.refresh_token);
    const maxAge = 60 * 60 * 24 * 365; // 1 year

    const headers = new Headers();
    headers.append('Location', loginRedirectPath);
    headers.append('Set-Cookie', setCookieHeader(cookieName, cookieValue, maxAge));
    headers.append('Set-Cookie', clearCsrf);

    return new Response(null, { status: 302, headers });
  }

  async function handleRefresh(request: Request): Promise<Response> {
    const cookie = getCookie(request, cookieName);
    if (!cookie) return errorResponse('No refresh token found', 401);

    const parsed = decodeRefreshCookie(cookie);
    if (!parsed) return errorResponse('Invalid refresh cookie', 401);

    const tokenResponse = await refreshAccessToken(parsed.refreshToken, provider);
    const newRefreshToken = tokenResponse.refresh_token || parsed.refreshToken;

    const responseHeaders: Record<string, string> = {};
    if (tokenResponse.refresh_token && tokenResponse.refresh_token !== parsed.refreshToken) {
      const updatedCookie = encodeRefreshCookie(parsed.provider, tokenResponse.refresh_token);
      const maxAge = 60 * 60 * 24 * 365;
      responseHeaders['Set-Cookie'] = setCookieHeader(cookieName, updatedCookie, maxAge);
    }

    return jsonResponse({
      access_token: tokenResponse.access_token,
      refresh_token: newRefreshToken,
      expires_in: tokenResponse.expires_in,
      provider: parsed.provider,
    }, 200, responseHeaders);
  }

  async function handleLogout(request: Request): Promise<Response> {
    const cookie = getCookie(request, cookieName);
    if (cookie) {
      const parsed = decodeRefreshCookie(cookie);
      if (parsed) {
        await fetch(`${provider.revokeUrl}?token=${parsed.refreshToken}`, { method: 'POST' });
      }
    }

    return jsonResponse({ ok: true }, 200, {
      'Set-Cookie': clearCookieHeader(cookieName),
    });
  }

  async function handleFeatureRefresh(request: Request): Promise<Response> {
    // Gate behind main auth cookie
    const authCookie = getCookie(request, cookieName);
    if (!authCookie) return errorResponse('Not authenticated', 401);

    const body = (await request.json()) as { provider?: string; refresh_token?: string };
    if (!body.provider || !body.refresh_token) return errorResponse('Missing provider or refresh_token');

    const tokenResponse = await refreshAccessToken(body.refresh_token, provider);

    return jsonResponse({
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token || body.refresh_token,
      expires_in: tokenResponse.expires_in,
      provider: body.provider,
    });
  }

  async function handleFeatureRevoke(request: Request): Promise<Response> {
    // Gate behind main auth cookie
    const authCookie = getCookie(request, cookieName);
    if (!authCookie) return errorResponse('Not authenticated', 401);

    const body = (await request.json()) as { provider?: string; token?: string };
    if (!body.provider || !body.token) return errorResponse('Missing provider or token');

    await fetch(`${provider.revokeUrl}?token=${body.token}`, { method: 'POST' });

    return jsonResponse({ ok: true });
  }

  return { handleLogin, handleCallback, handleRefresh, handleLogout, handleFeatureRefresh, handleFeatureRevoke };
}
