import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { AuthState } from '@strata-adapters/auth/auth-adapter';
import { AuthService } from '@strata-adapters/auth/auth-service';
import { LOGIN_FEATURE } from '@strata-adapters/auth/constants';
import type { StrataConfig } from '@strata-adapters/services/strata-config';
import { createStrataInstance, type StrataInstance } from '@strata-adapters/services/strata-factory';
import { StrataContext } from './context';

export type StrataProviderProps = {
  readonly config: StrataConfig;
  readonly children: ReactNode;
};

export function StrataProvider({ config, children }: StrataProviderProps) {
  const authService = useMemo(
    () =>
      new AuthService({
        providers: config.providers,
        sessionKey: config.storageKeys.session,
        returnUrlKey: config.storageKeys.returnUrl,
        featureCredsKey: config.storageKeys.featureCreds,
      }),
    [config],
  );

  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' });
  const [instance, setInstance] = useState<StrataInstance | null>(null);
  const instanceRef = useRef<StrataInstance | null>(null);
  const activeProviderRef = useRef<string | null>(null);

  useEffect(() => {
    void authService.tryRestoreSession();
    const sub = authService.state$.subscribe(setAuthState);
    return () => sub.unsubscribe();
  }, [authService]);

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

    const provider = config.providers.find((p) => p.name === next);
    if (!provider?.cloud) {
      throw new Error(`Provider "${next}" has no cloud factory registered`);
    }
    if (!provider.features[LOGIN_FEATURE]) {
      throw new Error(`Provider "${next}" is not a login provider`);
    }

    const inst = createStrataInstance({
      auth: authService,
      cloud: provider.cloud,
      appId: config.appId,
      deviceIdKey: config.storageKeys.deviceId,
      entities: config.entities,
      encryption: config.encryption,
      migrations: config.migrations,
      options: config.options,
    });
    instanceRef.current = inst;
    activeProviderRef.current = next;
    setInstance(inst);
  }, [authState, authService, config]);

  useEffect(() => {
    return () => {
      void instanceRef.current?.dispose();
      instanceRef.current = null;
      activeProviderRef.current = null;
    };
  }, []);

  return (
    <StrataContext.Provider
      value={{
        strata: instance?.strata ?? null,
        authState,
        errorBus: instance?.errorBus ?? null,
        authService,
      }}
    >
      {children}
    </StrataContext.Provider>
  );
}
