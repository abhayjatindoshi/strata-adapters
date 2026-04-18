import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { combineLatest, distinctUntilChanged, map } from 'rxjs';
import type { AuthAdapter, AuthState } from '@strata-adapters/auth/auth-adapter';
import type { StrataConfig } from '@strata-adapters/services/strata-config';
import { createStrataInstance, type StrataInstance } from '@strata-adapters/services/strata-factory';
import { StrataContext } from './context';

export type StrataProviderProps = {
  readonly config: StrataConfig;
  readonly children: ReactNode;
};

type Adapters = Readonly<Record<string, AuthAdapter>>;

function buildAdapters(config: StrataConfig): Adapters {
  const result: Record<string, AuthAdapter> = {};
  for (const [name, reg] of Object.entries(config.providers)) {
    result[name] = reg.auth();
  }
  return result;
}

function pickActiveState(states: readonly AuthState[], names: readonly string[]): AuthState {
  for (let i = 0; i < states.length; i++) {
    if (states[i].status === 'authenticated') {
      return { status: 'authenticated', provider: states[i].provider ?? names[i] };
    }
  }
  if (states.some((s) => s.status === 'loading')) return { status: 'loading' };
  return { status: 'unauthenticated' };
}

export function StrataProvider({ config, children }: StrataProviderProps) {
  const adapters = useMemo(() => buildAdapters(config), [config]);
  const providerNames = useMemo(() => Object.keys(config.providers), [config]);

  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' });
  const [instance, setInstance] = useState<StrataInstance | null>(null);
  const instanceRef = useRef<StrataInstance | null>(null);
  const activeProviderRef = useRef<string | null>(null);

  useEffect(() => {
    const streams = providerNames.map((n) => adapters[n].state$);
    const sub = combineLatest(streams)
      .pipe(
        map((states) => pickActiveState(states, providerNames)),
        distinctUntilChanged((a, b) => a.status === b.status && a.provider === b.provider),
      )
      .subscribe(setAuthState);
    return () => sub.unsubscribe();
  }, [adapters, providerNames]);

  useEffect(() => {
    const isAuthed = authState.status === 'authenticated' && !!authState.provider;
    const next = isAuthed ? authState.provider! : null;

    if (next === activeProviderRef.current) return;

    if (instanceRef.current) {
      const prev = instanceRef.current;
      instanceRef.current = null;
      activeProviderRef.current = null;
      setInstance(null);
      void prev.dispose();
    }

    if (!next) return;

    const reg = config.providers[next];
    if (!reg?.cloud) {
      throw new Error(`Provider "${next}" has no cloud factory registered`);
    }

    const inst = createStrataInstance({
      auth: adapters[next],
      cloud: reg.cloud,
      appId: config.appId,
      deviceIdKey: config.deviceIdKey,
      entities: config.entities,
      encryption: config.encryption,
      migrations: config.migrations,
      options: config.options,
    });
    instanceRef.current = inst;
    activeProviderRef.current = next;
    setInstance(inst);
  }, [authState, adapters, config]);

  useEffect(() => {
    return () => {
      void instanceRef.current?.dispose();
      instanceRef.current = null;
      activeProviderRef.current = null;
    };
  }, []);

  const activeAuth = authState.provider ? adapters[authState.provider] ?? null : null;

  return (
    <StrataContext.Provider
      value={{
        strata: instance?.strata ?? null,
        authState,
        errorBus: instance?.errorBus ?? null,
        providers: providerNames,
        auth: activeAuth,
      }}
    >
      {children}
    </StrataContext.Provider>
  );
}
