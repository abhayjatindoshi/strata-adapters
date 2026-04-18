import { useState, useCallback } from 'react';
import type { Tenant, CreateTenantOptions, JoinTenantOptions } from 'strata-data-sync';
import { validateGoogleDriveMeta, type GoogleDriveSpace } from '../google-tenant-meta';
import { useStrata } from '@strata-adapters/react/hooks/use-strata';

// --- Google Create Form ---

export type GoogleCreateFormState = {
  readonly name: string;
  readonly shareable: boolean;
  readonly space: GoogleDriveSpace;
  readonly folderId: string | undefined;
  readonly folderName: string | undefined;
  readonly submitting: boolean;
  readonly error: Error | null;
};

export function useGoogleCreateForm(): {
  readonly state: GoogleCreateFormState;
  readonly setName: (name: string) => void;
  readonly setShareable: (shareable: boolean) => void;
  readonly setFolder: (folderId: string, folderName: string) => void;
  readonly setSpace: (space: GoogleDriveSpace) => void;
  readonly submit: (opts?: { credential?: string }) => Promise<Tenant>;
  readonly reset: () => void;
} {
  const { strata } = useStrata();
  const [state, setState] = useState<GoogleCreateFormState>({
    name: '',
    shareable: false,
    space: 'appDataFolder',
    folderId: undefined,
    folderName: undefined,
    submitting: false,
    error: null,
  });

  const setName = useCallback((name: string) => {
    setState((s) => ({ ...s, name, error: null }));
  }, []);

  const setShareable = useCallback((shareable: boolean) => {
    setState((s) => ({
      ...s,
      shareable,
      space: shareable ? 'drive' : 'appDataFolder',
      folderId: shareable ? s.folderId : undefined,
      folderName: shareable ? s.folderName : undefined,
      error: null,
    }));
  }, []);

  const setFolder = useCallback((folderId: string, folderName: string) => {
    setState((s) => ({ ...s, folderId, folderName, error: null }));
  }, []);

  const setSpace = useCallback((space: GoogleDriveSpace) => {
    setState((s) => ({ ...s, space, error: null }));
  }, []);

  const submit = useCallback(
    async (opts?: { credential?: string }) => {
      if (!strata) throw new Error('Strata not initialized');
      if (!state.name.trim()) throw new Error('Name is required');

      const meta: Record<string, unknown> = { space: state.space };
      if (state.folderId) meta.folderId = state.folderId;

      validateGoogleDriveMeta(meta);

      setState((s) => ({ ...s, submitting: true, error: null }));
      try {
        const createOpts: CreateTenantOptions = {
          name: state.name.trim(),
          meta,
          ...(opts?.credential ? { encryption: { credential: opts.credential } } : {}),
        };
        const tenant = await strata.tenants.create(createOpts);
        return tenant;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState((s) => ({ ...s, error }));
        throw error;
      } finally {
        setState((s) => ({ ...s, submitting: false }));
      }
    },
    [strata, state.name, state.space, state.folderId],
  );

  const reset = useCallback(() => {
    setState({
      name: '',
      shareable: false,
      space: 'appDataFolder',
      folderId: undefined,
      folderName: undefined,
      submitting: false,
      error: null,
    });
  }, []);

  return { state, setName, setShareable, setFolder, setSpace, submit, reset };
}

// --- Google Open Form ---

export type GoogleOpenFormState = {
  readonly folderId: string | undefined;
  readonly folderName: string | undefined;
  readonly space: GoogleDriveSpace;
  readonly submitting: boolean;
  readonly error: Error | null;
};

export function useGoogleOpenForm(): {
  readonly state: GoogleOpenFormState;
  readonly setFolder: (folderId: string, folderName: string) => void;
  readonly setSpace: (space: GoogleDriveSpace) => void;
  readonly submit: (opts?: { name?: string; credential?: string }) => Promise<Tenant>;
  readonly reset: () => void;
} {
  const { strata } = useStrata();
  const [state, setState] = useState<GoogleOpenFormState>({
    folderId: undefined,
    folderName: undefined,
    space: 'drive',
    submitting: false,
    error: null,
  });

  const setFolder = useCallback((folderId: string, folderName: string) => {
    setState((s) => ({ ...s, folderId, folderName, error: null }));
  }, []);

  const setSpace = useCallback((space: GoogleDriveSpace) => {
    setState((s) => ({ ...s, space, error: null }));
  }, []);

  const submit = useCallback(
    async (opts?: { name?: string; credential?: string }) => {
      if (!strata) throw new Error('Strata not initialized');
      if (!state.folderId) throw new Error('Folder is required');

      const meta: Record<string, unknown> = { space: state.space, folderId: state.folderId };
      validateGoogleDriveMeta(meta);

      setState((s) => ({ ...s, submitting: true, error: null }));
      try {
        const probe = await strata.tenants.probe({ meta });
        if (!probe.exists) {
          throw new Error('Selected folder does not contain Strata data');
        }

        const joinOpts: JoinTenantOptions = {
          meta,
          name: opts?.name ?? state.folderName,
        };
        const tenant = await strata.tenants.join(joinOpts);

        if (probe.encrypted && opts?.credential) {
          await strata.tenants.open(tenant.id, { credential: opts.credential });
        }

        return tenant;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState((s) => ({ ...s, error }));
        throw error;
      } finally {
        setState((s) => ({ ...s, submitting: false }));
      }
    },
    [strata, state.folderId, state.space, state.folderName],
  );

  const reset = useCallback(() => {
    setState({
      folderId: undefined,
      folderName: undefined,
      space: 'drive',
      submitting: false,
      error: null,
    });
  }, []);

  return { state, setFolder, setSpace, submit, reset };
}
