export function generateState(provider: string, feature: string): string {
  const csrf = crypto.randomUUID();
  const payload = { provider, feature, csrf };
  return btoa(JSON.stringify(payload));
}

export type OAuthState = {
  readonly provider: string;
  readonly feature: string;
  readonly csrf: string;
};

export function parseState(state: string): OAuthState {
  return JSON.parse(atob(state)) as OAuthState;
}

export function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

export function setCookieHeader(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearCookieHeader(name: string): string {
  return `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function getCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`));
  return match?.substring(name.length + 1);
}

export function encodeRefreshCookie(provider: string, refreshToken: string): string {
  return btoa(JSON.stringify({ provider, refreshToken }));
}

export function decodeRefreshCookie(value: string): { provider: string; refreshToken: string } | null {
  try {
    return JSON.parse(atob(value)) as { provider: string; refreshToken: string };
  } catch {
    return null;
  }
}

export function isSafeReturnUrl(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\') && !url.toLowerCase().startsWith('javascript:');
}
