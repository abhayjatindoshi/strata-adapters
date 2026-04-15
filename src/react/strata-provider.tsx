import { useState, useEffect, useRef, type ReactNode } from 'react';
import type { EntityDefinition, StrataOptions, BlobMigration, EncryptionService } from 'strata-data-sync';
import type { AuthAdapter, AuthState } from '@strata-adapters/auth/auth-adapter';
import type { CloudProvider, StrataInstance } from '@strata-adapters/services/strata-factory';
import { createStrataInstance } from '@strata-adapters/services/strata-factory';
import { StrataContext } from './context';

export type StrataProviderProps = {
  readonly auth: AuthAdapter;
  readonly appId: string;
  readonly deviceIdKey: string;
  readonly entities: ReadonlyArray<EntityDefinition<any>>;
  readonly cloudProvider: CloudProvider;
  readonly encryption?: {
    readonly targets?: ReadonlyArray<'local' | 'cloud'>;
  } | EncryptionService;
  readonly migrations?: ReadonlyArray<BlobMigration>;
  readonly options?: StrataOptions;
  readonly children: ReactNode;
};

export function StrataProvider({
  auth,
  appId,
  deviceIdKey,
  entities,
  cloudProvider,
  encryption,
  migrations,
  options,
  children,
}: StrataProviderProps) {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [instance, setInstance] = useState<StrataInstance | null>(null);
  const instanceRef = useRef<StrataInstance | null>(null);

  useEffect(() => {
    const sub = auth.state$.subscribe(setAuthState);
    return () => sub.unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (authState === 'authenticated' && !instanceRef.current) {
      const inst = createStrataInstance({
        auth,
        appId,
        deviceIdKey,
        entities,
        cloudProvider,
        encryption,
        migrations,
        options,
      });
      instanceRef.current = inst;
      setInstance(inst);
    } else if (authState !== 'authenticated' && instanceRef.current) {
      const prev = instanceRef.current;
      instanceRef.current = null;
      setInstance(null);
      prev.dispose();
    }
  }, [authState, auth, appId, entities, cloudProvider, encryption, migrations, options]);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  return (
    <StrataContext.Provider
      value={{
        strata: instance?.strata ?? null,
        authState,
        errorBus: instance?.errorBus ?? null,
      }}
    >
      {children}
    </StrataContext.Provider>
  );
}
