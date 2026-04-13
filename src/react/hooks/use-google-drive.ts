import { useState, useCallback, useMemo } from 'react';
import type { Tenant, CreateTenantOptions, JoinTenantOptions } from 'strata-data-sync';
import { GoogleDriveBrowser, type DriveFile } from '@strata-adapters/browsers/google-drive-browser';
import { validateGoogleDriveMeta, type GoogleDriveSpace } from '@strata-adapters/services/tenant-meta';
import { useStrata } from './use-strata';

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

// --- Google File Browser ---

export type GoogleFileBrowserState = {
  readonly files: ReadonlyArray<DriveFile>;
  readonly currentFolderId: string;
  readonly breadcrumbs: ReadonlyArray<{ id: string; name: string }>;
  readonly loading: boolean;
  readonly error: Error | null;
};

export function useGoogleFileBrowser(
  getAccessToken: () => Promise<string>,
  rootFolderId: string = 'root',
): {
  readonly state: GoogleFileBrowserState;
  readonly navigateTo: (folderId: string, folderName: string) => void;
  readonly navigateUp: () => void;
  readonly createFolder: (name: string) => Promise<DriveFile>;
  readonly refresh: () => void;
} {
  const browser = useMemo(() => new GoogleDriveBrowser(getAccessToken), [getAccessToken]);
  const [state, setState] = useState<GoogleFileBrowserState>({
    files: [],
    currentFolderId: rootFolderId,
    breadcrumbs: [{ id: rootFolderId, name: 'My Drive' }],
    loading: false,
    error: null,
  });

  const loadFiles = useCallback(
    async (folderId: string) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const files = await browser.listFiles(folderId);
        setState((s) => ({ ...s, files, loading: false }));
      } catch (err) {
        setState((s) => ({
          ...s,
          files: [],
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      }
    },
    [browser],
  );

  const navigateTo = useCallback(
    (folderId: string, folderName: string) => {
      setState((s) => ({
        ...s,
        currentFolderId: folderId,
        breadcrumbs: [...s.breadcrumbs, { id: folderId, name: folderName }],
      }));
      loadFiles(folderId);
    },
    [loadFiles],
  );

  const navigateUp = useCallback(() => {
    setState((s) => {
      if (s.breadcrumbs.length <= 1) return s;
      const newBreadcrumbs = s.breadcrumbs.slice(0, -1);
      const parentId = newBreadcrumbs[newBreadcrumbs.length - 1].id;
      loadFiles(parentId);
      return {
        ...s,
        currentFolderId: parentId,
        breadcrumbs: newBreadcrumbs,
      };
    });
  }, [loadFiles]);

  const createFolder = useCallback(
    async (name: string) => {
      const folder = await browser.createFolder(name, state.currentFolderId);
      await loadFiles(state.currentFolderId);
      return folder;
    },
    [browser, state.currentFolderId, loadFiles],
  );

  const refresh = useCallback(() => {
    loadFiles(state.currentFolderId);
  }, [loadFiles, state.currentFolderId]);

  return { state, navigateTo, navigateUp, createFolder, refresh };
}
