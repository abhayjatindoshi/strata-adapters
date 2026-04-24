import type { ServerAuthAdapter } from './types';
import {
  generateState,
  parseState,
  jsonResponse,
  errorResponse,
  setCookieHeader,
  clearCookieHeader,
  getCookie,
} from './oauth-utils';

export type ServerAuthRegistration = {
  readonly adapter: ServerAuthAdapter;
  readonly refreshCookieName: string;
  readonly csrfCookieName: string;
  readonly loginRedirectPath: string;
  readonly errorRedirectPath: string;
};

export type ServerAuthServiceOptions = {
  /** URL prefix shared by all auth routes (e.g. `'/api/auth'`). */
  readonly basePath: string;
};

const CSRF_MAX_AGE = 600;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Owns all HTTP handling for server-side auth: routing, cookies, CSRF,
 * scope lookup, and response construction. Delegates protocol-specific
 * operations (auth URL, code exchange, refresh, logout) to the registered
 * `ServerAuthAdapter`s.
 *
 * Per PLUGGABLES_V2 §6.
 */
export class ServerAuthService {
  private readonly basePath: string;
  private readonly byName: ReadonlyMap<string, ServerAuthRegistration>;

  constructor(registrations: readonly ServerAuthRegistration[], options: ServerAuthServiceOptions) {
    const byName = new Map<string, ServerAuthRegistration>();
    for (const r of registrations) {
      if (byName.has(r.adapter.name)) {
        throw new Error(`ServerAuthService: duplicate adapter name "${r.adapter.name}"`);
      }
      byName.set(r.adapter.name, r);
    }
    this.byName = byName;
    this.basePath = options.basePath.replace(/\/+$/, '');
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = this.stripBase(url.pathname);
    if (path === null) return new Response('Not found', { status: 404 });

    const method = request.method;

    if (method === 'GET' && path === '/callback') return this.handleCallback(request, url);

    const reg = this.resolveByProvider(url);
    if (!reg) return new Response('Not found', { status: 404 });

    if (method === 'GET' && path === '/login') return this.handleLogin(url, reg);
    if (method === 'POST' && path === '/refresh') return this.handleRefresh(request, reg);
    if (method === 'POST' && path === '/logout') return this.handleLogout(request, reg);

    return new Response('Not found', { status: 404 });
  }

  // ─── handlers ────────────────────────────────────────────

  private handleLogin(url: URL, reg: ServerAuthRegistration): Response {
    const feature = url.searchParams.get('feature') ?? 'login';
    const scopes = reg.adapter.scopes[feature];
    if (!scopes) return errorResponse(`Unknown feature: ${feature}`, 400);

    const { state, csrf } = generateState(reg.adapter.name, feature);
    const authUrl = reg.adapter.login(state, feature);

    return new Response(null, {
      status: 302,
      headers: {
        Location: authUrl,
        'Set-Cookie': setCookieHeader(reg.csrfCookieName, csrf, CSRF_MAX_AGE),
      },
    });
  }

  private async handleCallback(request: Request, url: URL): Promise<Response> {
    const stateParam = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    if (url.searchParams.get('error') || !code || !stateParam) {
      return new Response('Not found', { status: 404 });
    }

    let state;
    try {
      state = parseState(stateParam);
    } catch {
      return new Response('Not found', { status: 404 });
    }

    const reg = this.byName.get(state.provider);
    if (!reg) return new Response('Not found', { status: 404 });

    const csrfCookie = getCookie(request, reg.csrfCookieName);
    if (!csrfCookie || csrfCookie !== state.csrf) return this.redirectError(reg);

    let result;
    try {
      result = await reg.adapter.exchangeCode(code);
    } catch {
      return this.redirectError(reg);
    }

    if (!result.refreshToken) return this.redirectError(reg);

    const headers = new Headers();
    headers.append('Location', reg.loginRedirectPath);
    headers.append('Set-Cookie', setCookieHeader(reg.refreshCookieName, result.refreshToken, REFRESH_MAX_AGE));
    headers.append('Set-Cookie', setCookieHeader(reg.csrfCookieName, '', 0));
    return new Response(null, { status: 302, headers });
  }

  private async handleRefresh(request: Request, reg: ServerAuthRegistration): Promise<Response> {
    const refreshToken = getCookie(request, reg.refreshCookieName);
    if (!refreshToken) return errorResponse('No refresh token found', 401);

    let result;
    try {
      result = await reg.adapter.refresh(refreshToken);
    } catch {
      return errorResponse('Refresh failed', 401);
    }

    const responseHeaders: Record<string, string> = {};
    if (result.refreshToken && result.refreshToken !== refreshToken) {
      responseHeaders['Set-Cookie'] = setCookieHeader(reg.refreshCookieName, result.refreshToken, REFRESH_MAX_AGE);
    }

    return jsonResponse(
      { access_token: result.accessToken, expires_in: result.expiresIn },
      200,
      responseHeaders,
    );
  }

  private async handleLogout(request: Request, reg: ServerAuthRegistration): Promise<Response> {
    const refreshToken = getCookie(request, reg.refreshCookieName);
    if (refreshToken) {
      try {
        await reg.adapter.logout(refreshToken);
      } catch {
        // best-effort
      }
    }
    return jsonResponse({ ok: true }, 200, { 'Set-Cookie': clearCookieHeader(reg.refreshCookieName) });
  }

  // ─── internals ───────────────────────────────────────────

  private stripBase(pathname: string): string | null {
    if (!this.basePath) return pathname;
    if (pathname === this.basePath) return '';
    if (pathname.startsWith(`${this.basePath}/`)) return pathname.slice(this.basePath.length);
    return null;
  }

  private resolveByProvider(url: URL): ServerAuthRegistration | undefined {
    const name = url.searchParams.get('provider');
    return name ? this.byName.get(name) : undefined;
  }

  private redirectError(reg: ServerAuthRegistration): Response {
    return new Response(null, { status: 302, headers: { Location: reg.errorRedirectPath } });
  }
}
