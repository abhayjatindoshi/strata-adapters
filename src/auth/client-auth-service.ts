import { BehaviorSubject, distinctUntilChanged, type Observable } from 'rxjs';
import type { AccessToken, ClientAuthAdapter, AuthState } from './types';

export type SupportedAuth = {
  readonly name: string;
  /** Begin the login flow for this adapter via the service. */
  login(): Promise<void>;
};

const REFRESH_LEEWAY_MS = 5 * 60 * 1000;

/**
 * Single browser-side auth surface. Aggregates `ClientAuthAdapter`s and
 * owns the **only** in-memory copy of the current access token, the active
 * adapter (encoded in `cached.name`), and inflight coalescing.
 *
 * The server-side refresh cookie carries the provider name, so the client
 * does not need to persist the active adapter — the first successful
 * `refresh()` determines who is signed in.
 *
 * Per PLUGGABLES_V2 §5 + decision SA22.
 */
export class ClientAuthService {
  private readonly byName: ReadonlyMap<string, ClientAuthAdapter>;
  private cached: AccessToken | null = null;
  private inflight: Promise<AccessToken | null> | null = null;
  private readonly state$$: BehaviorSubject<AuthState>;
  readonly state$: Observable<AuthState>;

  constructor(
    private readonly adapters: readonly ClientAuthAdapter[],
  ) {
    const byName = new Map<string, ClientAuthAdapter>();
    for (const a of adapters) {
      if (byName.has(a.name)) throw new Error(`ClientAuthService: duplicate adapter name "${a.name}"`);
      byName.set(a.name, a);
    }
    this.byName = byName;
    this.state$$ = new BehaviorSubject<AuthState>({ status: 'loading' });
    this.state$ = this.state$$.pipe(
      distinctUntilChanged((a, b) => a.status === b.status && a.name === b.name),
    );

    // Probe adapters so state$ transitions from 'loading' to
    // 'signed-in' or 'signed-out' without waiting for the first
    // explicit getAccessToken() call.
    void this.getAccessToken();
  }

  /**
   * Returns the cached token if it has more than 5 minutes of life left,
   * otherwise refreshes by trying each adapter. Coalesces concurrent calls.
   * Emits `signed-in` / `signed-out` as appropriate.
   *
   * Returns `null` when no adapter has a valid session.
   */
  async getAccessToken(): Promise<AccessToken | null> {
    if (this.cached && (this.cached.expiresAt ?? 0) - Date.now() > REFRESH_LEEWAY_MS) {
      return this.cached;
    }
    if (this.inflight) return this.inflight;
    this.inflight = this.refreshAny();
    try {
      return await this.inflight;
    } finally {
      this.inflight = null;
    }
  }

  /**
   * Drives the login page. Each `login()` invokes the adapter directly
   * (BFF login redirects, so we never come back to this code path
   * post-call).
   */
  supportedAuths(): readonly SupportedAuth[] {
    return this.adapters.map((a) => ({
      name: a.name,
      login: async () => {
        this.cached = null;
        await a.login();
      },
    }));
  }

  /**
   * Logs out the active adapter (best-effort), clears cached token,
   * emits `signed-out`.
   */
  async logout(): Promise<void> {
    const name = this.cached?.name;
    const adapter = name ? this.byName.get(name) : undefined;
    this.cached = null;
    this.emit();
    if (adapter) {
      await adapter.logout();
    } else {
      for (const a of this.adapters) {
        try { await a.logout(); } catch { /* best-effort */ }
      }
    }
  }

  // ─── internals ───────────────────────────────────────────

  private async refreshAny(): Promise<AccessToken | null> {
    for (const adapter of this.adapters) {
      let refreshed;
      try {
        refreshed = await adapter.refresh();
      } catch {
        refreshed = null;
      }
      if (refreshed) {
        this.cached = refreshed;
        this.emit();
        return this.cached;
      }
    }
    this.cached = null;
    this.emit();
    return null;
  }

  private emit(): void {
    this.state$$.next(
      this.cached
        ? { status: 'signed-in', name: this.cached.name }
        : { status: 'signed-out' },
    );
  }
}
