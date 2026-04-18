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

export type ServerProvider = ProviderConfig & {
  readonly clientSecret: string;
  readonly callbackUrl: string;
};

export type ProviderMap = Readonly<Record<string, ServerProvider>>;

export type OAuthHandlersConfig = {
  readonly cookieName: string;
  readonly providers: ProviderMap;
  readonly csrfCookieName?: string;
  readonly loginRedirectPath?: string;
  readonly featureCallbackPath?: string;
  readonly errorRedirectPath?: string;
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
const REFRESH_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function createOAuthHandlers(config: OAuthHandlersConfig): OAuthHandlers {
  const {
    cookieName,
    providers,
    csrfCookieName = 'oauth_csrf',
    loginRedirectPath = '/',
    featureCallbackPath = '/auth/feature/callback',
    errorRedirectPath = '/login?error=auth_failed',
  } = config;

  const lookup = (name: string | null | undefined): ServerProvider | undefined =>
    name ? providers[name] : undefined;

  const redirect = (path: string): Response =>
    new Response(null, { status: 302, headers: { Location: path } });

  async function handleLogin(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const provider = lookup(url.searchParams.get('provider'));
    if (!provider) return errorResponse('Unknown or missing provider');

    const feature = url.searchParams.get('feature') ?? 'login';
    const scopes = provider.scopes[feature];
    if (!scopes) return errorResponse(`Unsupported feature: ${feature}`);

    const state = generateState(provider.name, feature);
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
    if (url.searchParams.get('error') || !code || !stateParam) return redirect(errorRedirectPath);

    let state: ReturnType<typeof parseState>;
    try { state = parseState(stateParam); } catch { return redirect(errorRedirectPath); }

    const provider = lookup(state.provider);
    if (!provider) return redirect(errorRedirectPath);

    const csrfCookie = getCookie(request, csrfCookieName);
    if (!csrfCookie || csrfCookie !== state.csrf) return redirect(errorRedirectPath);

    let tokenResponse;
    try { tokenResponse = await exchangeCode(code, provider); }
    catch { return redirect(errorRedirectPath); }

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
        headers: { Location: `${featureCallbackPath}#${fragment.toString()}`, 'Set-Cookie': clearCsrf },
      });
    }

    if (!tokenResponse.refresh_token) return redirect(errorRedirectPath);

    const cookieValue = encodeRefreshCookie(state.provider, tokenResponse.refresh_token);
    const headers = new Headers();
    headers.append('Location', loginRedirectPath);
    headers.append('Set-Cookie', setCookieHeader(cookieName, cookieValue, REFRESH_MAX_AGE));
    headers.append('Set-Cookie', clearCsrf);
    return new Response(null, { status: 302, headers });
  }

  async function handleRefresh(request: Request): Promise<Response> {
    const cookie = getCookie(request, cookieName);
    if (!cookie) return errorResponse('No refresh token found', 401);

    const parsed = decodeRefreshCookie(cookie);
    if (!parsed) return errorResponse('Invalid refresh cookie', 401);

    const provider = lookup(parsed.provider);
    if (!provider) return errorResponse('Unknown provider', 401);

    const tokenResponse = await refreshAccessToken(parsed.refreshToken, provider);
    const newRefreshToken = tokenResponse.refresh_token || parsed.refreshToken;

    const responseHeaders: Record<string, string> = {};
    if (tokenResponse.refresh_token && tokenResponse.refresh_token !== parsed.refreshToken) {
      const updated = encodeRefreshCookie(parsed.provider, tokenResponse.refresh_token);
      responseHeaders['Set-Cookie'] = setCookieHeader(cookieName, updated, REFRESH_MAX_AGE);
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
      const provider = parsed ? lookup(parsed.provider) : undefined;
      if (parsed && provider) {
        await fetch(`${provider.revokeUrl}?token=${parsed.refreshToken}`, { method: 'POST' });
      }
    }
    return jsonResponse({ ok: true }, 200, { 'Set-Cookie': clearCookieHeader(cookieName) });
  }

  async function handleFeatureRefresh(request: Request): Promise<Response> {
    if (!getCookie(request, cookieName)) return errorResponse('Not authenticated', 401);

    const body = (await request.json()) as { provider?: string; refresh_token?: string };
    if (!body.provider || !body.refresh_token) return errorResponse('Missing provider or refresh_token');

    const provider = lookup(body.provider);
    if (!provider) return errorResponse(`Unknown provider: ${body.provider}`);

    const tokenResponse = await refreshAccessToken(body.refresh_token, provider);

    return jsonResponse({
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token || body.refresh_token,
      expires_in: tokenResponse.expires_in,
      provider: body.provider,
    });
  }

  async function handleFeatureRevoke(request: Request): Promise<Response> {
    if (!getCookie(request, cookieName)) return errorResponse('Not authenticated', 401);

    const body = (await request.json()) as { provider?: string; token?: string };
    if (!body.provider || !body.token) return errorResponse('Missing provider or token');

    const provider = lookup(body.provider);
    if (!provider) return errorResponse(`Unknown provider: ${body.provider}`);

    await fetch(`${provider.revokeUrl}?token=${body.token}`, { method: 'POST' });
    return jsonResponse({ ok: true });
  }

  return { handleLogin, handleCallback, handleRefresh, handleLogout, handleFeatureRefresh, handleFeatureRevoke };
}
