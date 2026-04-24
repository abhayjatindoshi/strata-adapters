import { BehaviorSubject, distinctUntilChanged, type Observable } from 'rxjs';
import type { AccessToken, ClientAuthAdapter, AuthState } from './types';

export type SupportedAuth = {
  readonly name: string;
  /** Begin the login flow for this adapter via the service. */
  login(): Promise<void>;
};

export type ClientAuthServiceOptions = {
  /**
   * `localStorage` key under which the active adapter name is persisted so
   * the same adapter can be re-selected after a redirect / page reload.
   */
  readonly activeAuthKey: string;
};

const REFRESH_LEEWAY_MS = 5 * 60 * 1000;

/**
 * Single browser-side auth surface. Aggregates `ClientAuthAdapter`s and
 * owns the **only** in-memory copy of the current access token, the active
 * adapter (encoded in `cached.name`), inflight coalescing, and a
 * `localStorage`-persisted "active adapter name" so the choice survives
 * the OAuth redirect.
 *
 * Per PLUGGABLES_V2 §5 + decision SA22.
 */
export class ClientAuthService {
  private readonly byName: ReadonlyMap<string, ClientAuthAdapter>;
  private readonly activeAuthKey: string;
  private cached: AccessToken | null = null;
  private inflight: Promise<AccessToken | null> | null = null;
  private readonly state$$: BehaviorSubject<AuthState>;
  readonly state$: Observable<AuthState>;

  constructor(
    private readonly adapters: readonly ClientAuthAdapter[],
    options: ClientAuthServiceOptions,
  ) {
    const byName = new Map<string, ClientAuthAdapter>();
    for (const a of adapters) {
      if (byName.has(a.name)) throw new Error(`ClientAuthService: duplicate adapter name "${a.name}"`);
      byName.set(a.name, a);
    }
    this.byName = byName;
    this.activeAuthKey = options.activeAuthKey;
    this.state$$ = new BehaviorSubject<AuthState>({ status: 'loading' });
    this.state$ = this.state$$.pipe(
      distinctUntilChanged((a, b) => a.status === b.status && a.name === b.name),
    );

    // Probe the persisted active adapter so state$ transitions from
    // 'loading' to 'signed-in' or 'signed-out' without waiting for
    // the first explicit getAccessToken() call.
    void this.getAccessToken();
  }

  /**
   * Returns the cached token if it has more than 5 minutes of life left,
   * otherwise refreshes against the persisted active adapter. Coalesces
   * concurrent calls. Emits `signed-in` / `signed-out` as appropriate.
   *
   * Returns `null` when no adapter is persisted as active or refresh
   * fails (in which case the persisted name is cleared and `signed-out`
   * is emitted).
   */
  async getAccessToken(): Promise<AccessToken | null> {
    if (this.cached && (this.cached.expiresAt ?? 0) - Date.now() > REFRESH_LEEWAY_MS) {
      return this.cached;
    }
    if (this.inflight) return this.inflight;
    this.inflight = this.refreshActive();
    try {
      return await this.inflight;
    } finally {
      this.inflight = null;
    }
  }

  /**
   * Marks `name` as the active adapter and clears any cached token. The
   * next `getAccessToken()` will refresh against the new adapter.
   */
  setActive(name: string): void {
    if (!this.byName.has(name)) throw new Error(`ClientAuthService: unknown adapter "${name}"`);
    this.persist(name);
    this.cached = null;
    this.emit();
  }

  /**
   * Drives the login page. Each `login()` persists the chosen adapter
   * name *before* invoking the adapter (BFF login redirects, so we never
   * come back to this code path post-call).
   */
  supportedAuths(): readonly SupportedAuth[] {
    return this.adapters.map((a) => ({
      name: a.name,
      login: async () => {
        this.persist(a.name);
        this.cached = null;
        await a.login();
      },
    }));
  }

  /**
   * Logs out the active adapter (best-effort), clears cached token,
   * clears persisted name, emits `signed-out`. No-op when no adapter is
   * active.
   */
  async logout(): Promise<void> {
    const name = this.cached?.name ?? this.persistedActive();
    const adapter = name ? this.byName.get(name) : undefined;
    this.cached = null;
    this.persist(null);
    this.emit();
    if (adapter) await adapter.logout();
  }

  // ─── internals ───────────────────────────────────────────

  private async refreshActive(): Promise<AccessToken | null> {
    const name = this.persistedActive();
    const adapter = name ? this.byName.get(name) : undefined;
    if (!adapter) {
      this.cached = null;
      this.persist(null);
      this.emit();
      return null;
    }

    let refreshed;
    try {
      refreshed = await adapter.refresh();
    } catch {
      refreshed = null;
    }
    if (!refreshed) {
      this.cached = null;
      this.persist(null);
      this.emit();
      return null;
    }

    this.cached = refreshed;
    this.emit();
    return this.cached;
  }

  private emit(): void {
    this.state$$.next(
      this.cached
        ? { status: 'signed-in', name: this.cached.name }
        : { status: 'signed-out' },
    );
  }

  private persistedActive(): string | null {
    const ls = this.storage();
    if (!ls) return null;
    return ls.getItem(this.activeAuthKey);
  }

  private persist(name: string | null): void {
    const ls = this.storage();
    if (!ls) return;
    if (name === null) ls.removeItem(this.activeAuthKey);
    else ls.setItem(this.activeAuthKey, name);
  }

  private storage(): Storage | null {
    try {
      return typeof globalThis !== 'undefined' && 'localStorage' in globalThis
        ? (globalThis as { localStorage?: Storage }).localStorage ?? null
        : null;
    } catch {
      return null;
    }
  }
}
