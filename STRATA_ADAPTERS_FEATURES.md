# strata-adapters — Feature Specification

## Design Principles

- Auth state and access tokens are separate concerns. The package consumes both via a single `AuthAdapter` interface.
- Single cloud provider per authenticated session.
- Every headless hook is independently usable. Composite hooks accept dependencies via options rather than creating them internally.
- Provider-specific logic is isolated — common abstractions where possible, provider modules where not.
- Everything is pluggable and replaceable — the package provides defaults for every aspect of a Strata-powered app, but the app can swap any piece.

---

## 0. Auth Adapter Interface

The package does not implement auth flows, but it consumes auth state and access tokens via a single interface:

```ts
type AuthAdapter = {
  // Reactive auth state — cheap, synchronous, no network calls
  state$: Observable<"loading" | "authenticated" | "unauthenticated">

  // Token for API calls — called on-demand by storage adapters
  getAccessToken(): Promise<string | null>
}
```

### Why two methods?

- `state$` is for UI decisions (route guards, conditional rendering). It must be fast and reactive — no network calls.
- `getAccessToken()` is for storage adapters when they need a token to make an API call. Called infrequently and on-demand.

### Three auth strategies

**1. PKCE (client-only, no backend):**
- The package could ship a ready-made adapter: `createPkceAuth({ provider: "google", clientId: "..." })`
- `state$` derives from token presence in memory
- `getAccessToken()` returns the stored token, refreshes if expired using PKCE flow
- Fully handled by the package — zero auth code in the app

**2. Server-based refresh token:**
- App implements the interface, wiring to their backend
- `state$` comes from the app's existing auth state management
- `getAccessToken()` calls the app's refresh endpoint if needed
- The package provides the adapter interface, app provides the implementation

**3. Fully custom (Firebase, Auth0, Supabase, etc.):**
- App implements the interface, delegating to their auth provider
- Example: `getAccessToken: () => firebase.auth().currentUser.getIdToken()`
- `state$` wraps the auth provider's own state observable

### Usage

```tsx
// PKCE — package provides
import { createPkceAuth } from 'strata-adapters'
const auth = createPkceAuth({ provider: "google", clientId: "..." })

// Server-based — app provides
const auth = { state$: myAuthService.state$, getAccessToken: () => myAuthService.getToken() }

// Firebase — app provides
const auth = { state$: firebaseAuthState$, getAccessToken: () => getIdToken(currentUser) }

// Pass to StrataProvider
<StrataProvider auth={auth} cloudProvider="google-drive" ...>
```

### RequireAuth guard

- Reads `auth.state$` from StrataProvider context — no network calls, no `getAccessToken` on route changes
- Shows nothing while `loading`, redirects to `/login` when `unauthenticated`, renders children when `authenticated`
- App can replace with its own guard — just don't use `RequireAuth`

---

## 1. Storage Adapters

Read/write/delete blobs to a storage backend. Implements `StorageAdapter` interface from `strata-data-sync`.

### GoogleDriveAdapter

- Backed by Google Drive API v3
- Constructor takes `getAccessToken: () => Promise<string>`
- Tenant meta schema: `{ space: "appDataFolder" | "drive" | "sharedWithMe", folderId?: string }`
- `space` is mandatory, `folderId` required for `drive` and `sharedWithMe`
- Uses `compositeKey(tenant, key)` from `strata-data-sync` for filenames
- Caches Drive file IDs in memory to minimize API calls
- Implements `deriveTenantId` using `meta.folderId` — deterministic across users sharing a folder
- Maps Google API errors (401, 403, 404, 429) to common `StrataError` kinds

### LocalStorageAdapter

- Backed by browser `localStorage`
- Optional key prefix to avoid collisions with other apps

*Future: OneDriveAdapter, S3Adapter, DropboxAdapter*

---

## 2. Transforms

Wrappers that compose around any `StorageAdapter` to add cross-cutting behavior.

### withGzip(adapter)

- Compresses data before write, decompresses on read
- Transparent to the consumer — same `StorageAdapter` interface

### withRetry(adapter, opts?)

- Retries failed read/write/delete operations
- Configurable: max retries, backoff strategy, which errors to retry
- Respects 429 Retry-After headers

---

## 3. Encryption

Pluggable encryption for tenant data at rest.

### AesGcmEncryptionStrategy

- AES-256-GCM encryption using Web Crypto API
- Random IV per encryption operation

### Pbkdf2EncryptionService

- PBKDF2 key derivation from user-provided password
- Configurable iterations, salt generation
- Pluggable encryption strategy (defaults to AesGcm)

---

## 4. Browser Services

Browse cloud storage to pick folders for tenant storage location. Not a `StorageAdapter` — separate concern.

### GoogleDriveBrowser

- List files/folders in a directory
- Create folder
- Get folder info (name, path, permissions)
- Supports My Drive, Shared with me spaces
- Constructor takes `getAccessToken: () => Promise<string>`

*Future: OneDriveBrowser, S3Browser, DropboxBrowser*

---

## 5. Strata Initialization

One-call setup that wires everything together from minimal config.

### Input

- `auth` — `AuthAdapter` instance (provides auth state + access token)
- `appId` — app identifier
- `entities` — array of entity definitions
- `cloudProvider` — which cloud backend (`"google-drive"`, future `"onedrive"`, etc.)
- `encryption?` — optional, password or encryption service
- `options?` — Strata options passthrough (sync interval, etc.)

### Handles internally

- **Auth state** — subscribes to `auth.state$`, initializes Strata when authenticated, disposes when unauthenticated
- **Device ID** — generates random UUID, persists in `localStorage`, reuses on subsequent loads
- **Local adapter** — creates `LocalStorageAdapter` with app-scoped prefix
- **Cloud adapter** — creates the right adapter based on `cloudProvider`, wires `auth.getAccessToken()` into it
- **Transforms** — applies `withGzip` and `withRetry` to cloud adapter by default
- **Encryption** — if password provided, creates `Pbkdf2EncryptionService` + `AesGcmEncryptionStrategy`
- **Strata instance** — creates with all of the above
- **Dispose** — cleans up Strata instance on unmount or auth loss

---

## 6. Tenant CRUD

Manage tenants through Strata's tenant registry.

### List tenants

- Returns all tenants with name, ID, meta, timestamps
- Observable for reactive updates when tenants are created/deleted

### Create tenant

- Takes name + provider-specific meta
- Validates meta based on cloud provider (space mandatory, folderId for drive/sharedWithMe)
- Creates tenant in Strata registry
- Returns created tenant

### Open existing tenant (from cloud)

- User picks a folder that already contains Strata data
- Derives tenant ID from folder via adapter's `deriveTenantId`
- Registers tenant in local registry if not already present
- Validates the folder actually contains Strata data before registering

### Delete tenant

- Removes from local registry
- Optionally deletes cloud data (with confirmation)

### Rename tenant

- Updates tenant name in registry

### Tenant settings

- View current storage location
- View encryption status
- Provider-specific settings display (which Drive folder, space, etc.)

---

## 7. Tenant Loading

Manage the active tenant lifecycle.

### Open

- `strata.tenants.open(tenantId)` — hydrates from local, triggers cloud sync
- Only one tenant active at a time per Strata instance

### Unload

- Closes active tenant, clears in-memory data
- Triggered on navigation away, tenant switch, logout

### URL-driven

- Reads tenant ID from URL param (`:tenantId`)
- Reacts to URL changes — unloads previous, loads new
- Redirects to tenant list if tenant ID is invalid or not found

---

## 8. Encryption Management

Common across all providers — operates at Strata level.

### Setup encryption

- User provides a password
- Derives encryption key via PBKDF2
- Encrypts all tenant data on next sync
- Stores encryption salt in tenant meta (not the password)

### Unlock encrypted tenant

- Prompts for password on tenant load if encrypted
- Derives key, decrypts data
- Keeps key in memory for session duration

### Change password

- Re-derives key with new password
- Re-encrypts all data
- Updates salt in tenant meta

### Remove encryption

- Decrypts all data
- Removes encryption metadata from tenant

---

## 9. Error Handling

Errors in an offline-first sync framework are **events, not exceptions**. The app keeps working on local data while errors are observed and surfaced to the user.

### Error class hierarchy

```ts
// Base class — used for global handling, error bus, generic catches
class StrataError extends Error {
  kind: ErrorKind
  operation: string        // 'read' | 'write' | 'delete' | 'list' | 'sync' | ...
  retryable: boolean
  originalError?: Error
}

// Subclasses — for targeted instanceof catches
class AuthExpiredError extends StrataError { kind = 'auth-expired' }
class OfflineError extends StrataError { kind = 'offline' }
class QuotaExceededError extends StrataError { kind = 'quota-exceeded' }
class PermissionDeniedError extends StrataError { kind = 'permission-denied' }
class NotFoundError extends StrataError { kind = 'not-found' }
class RateLimitedError extends StrataError { kind = 'rate-limited' }
class DataCorruptedError extends StrataError { kind = 'data-corrupted' }
```

### Three layers of error handling

**1. Adapters: throw typed errors**
- Adapters catch raw provider errors and throw typed `StrataError` subclasses
- Classification happens here: HTTP 401 → `AuthExpiredError`, timeout → `OfflineError`, etc.
- No handling logic — just classification and throwing

**2. Package: intercept and broadcast**
- `withErrorBroadcast(adapter, bus)` wraps any adapter
- Intercepts every call, emits errors on a shared `ErrorBus` (RxJS Subject)
- Re-throws so strata core still sees the error for its own retry/failure handling
- UI layer simultaneously gets the error for display

**3. React layer: subscribe and act**
- `useStrataError()` aggregates errors from the error bus, sync events, and encryption errors
- Returns `lastError`, `errors$` observable, `dismiss()`, `retry()` (if retryable)
- Apps can use the hook for custom handling or a default error boundary component

### Error kinds

| Kind | Subclass | Retryable | Description |
|---|---|---|---|
| `auth-expired` | `AuthExpiredError` | No | Token invalid/expired, needs re-auth |
| `quota-exceeded` | `QuotaExceededError` | No | Storage full (Drive quota, localStorage limit) |
| `not-found` | `NotFoundError` | No | Storage location deleted externally |
| `permission-denied` | `PermissionDeniedError` | No | Lost access to storage |
| `offline` | `OfflineError` | Yes | No network connectivity |
| `rate-limited` | `RateLimitedError` | Yes | Too many API requests |
| `data-corrupted` | `DataCorruptedError` | No | Blob can't be deserialized or decrypted |
| `unknown` | `StrataError` | No | Fallback with original error attached |

### Error mapping per adapter

- Google: 401 → `AuthExpiredError`, 403 → `PermissionDeniedError`, 404 → `NotFoundError`, 429 → `RateLimitedError`
- LocalStorage: quota exceeded → `QuotaExceededError`

### Usage patterns

**Targeted — catch specific errors:**
```ts
try {
  await strata.tenants.open(tenantId)
} catch (e) {
  if (e instanceof AuthExpiredError) redirectToLogin()
  if (e instanceof DataCorruptedError) promptForPassword()
  throw e
}
```

**Global — observe all errors:**
```ts
errorBus.errors$.subscribe(err => {
  if (err.retryable) showRetryToast(err.message)
  else showErrorBanner(err.message)
})
```

**Exhaustive — switch on kind:**
```ts
switch (err.kind) {
  case 'auth-expired': ...
  case 'offline': ...
  // ...
}
```

---

## 10. Provider-Specific Tenant Forms

Each cloud provider has its own tenant creation/management UX because storage concepts differ.

### Google Drive

**Create form:**
- Tenant name input
- Shareable toggle
  - If shareable → space picker (My Drive / Shared with me) → folder picker → confirm
  - If not shareable → stored in appDataFolder, no picker needed
- Validates: name required, folderId required if shareable
- Submits: creates tenant with correct meta

**Open form:**
- Folder picker (My Drive / Shared with me)
- Validates folder contains Strata data
- Derives tenant ID from folder
- Registers tenant locally

**Share form (if provider supports):**
- Shows current sharing status of the Drive folder
- Provides link/action to manage sharing via Google Drive
- Detects when new users have access

**Folder browser (used by create/open/share):**
- Navigate into folders
- Breadcrumb trail
- Create new folder
- Select folder
- Loading/empty/error states
- Scoped to My Drive or Shared with me

*Future: OneDrive forms (OneDrive folders, SharePoint sites), S3 forms (bucket + prefix), etc.*

---

## 11. Sync Status

Observable sync lifecycle state for UI feedback.

### States

| State | Description |
|---|---|
| `idle` | No sync in progress, data is up to date |
| `syncing` | Sync in progress (uploading/downloading) |
| `synced` | Sync just completed successfully |
| `failed` | Last sync failed (with error) |
| `offline` | No connectivity, operating on local data only |

### Dirty state

- Boolean indicating unsaved local changes that haven't been persisted/synced
- Observable for reactive UI updates (e.g., "unsaved changes" dot)

---

## 12. React Integration

Hooks, providers, guards, and default UI for React apps.

### Providers

- `StrataProvider` — accepts `auth` (AuthAdapter) + config props, subscribes to `auth.state$`, initializes Strata when authenticated, provides instance + auth state via context, disposes on unmount or auth loss
- `TenantProvider` — reads `:tenantId` from URL, opens/unloads tenant, provides active tenant via context

### Route Guards

- `RequireAuth` — reads auth state from StrataProvider context (derived from `auth.state$`), redirects to `/login` if unauthenticated, shows nothing while loading. App can replace with its own guard.
- `RequireTenant` — checks active tenant, redirects to `/tenants` if invalid/missing

### Generic Hooks

| Hook | Purpose |
|---|---|
| `useStrata()` | Access Strata instance |
| `useTenant()` | Access active tenant |
| `useTenantList()` | List tenants, subscribe to changes |
| `useSyncStatus()` | Subscribe to sync state |
| `useDirtyState()` | Subscribe to dirty flag |
| `useStrataError()` | Subscribe to error stream |
| `useEncryption()` | Encryption state and actions (setup, unlock, change, remove) |
| `useRepo(entityDef)` | Access repository |
| `useEntity(entityDef, id)` | Observe single entity |
| `useQuery(entityDef, opts?)` | Observe query results |

### Provider-Specific Hooks (Google)

| Hook | Purpose |
|---|---|
| `useGoogleCreateForm()` | Create tenant form state and logic |
| `useGoogleOpenForm()` | Open existing tenant form state and logic |
| `useGoogleShareForm()` | Share tenant form state and logic |
| `useGoogleFileBrowser()` | Folder navigation state and actions |

### Default UI (themed per provider)

| Component | Description |
|---|---|
| `GoogleLoginButton` | Branded Google sign-in button |
| `GoogleCreateForm` | Styled create tenant form |
| `GoogleOpenForm` | Styled open tenant form |
| `GoogleShareForm` | Styled share form |
| `EncryptionPage` | Common encryption management UI |
| `TenantListPage` | Generic tenant list with create/open/delete actions |
| `SyncStatusIndicator` | Sync state badge/spinner |

---

## Import/Export (Future)

- Export tenant data to a portable format (encrypted blob)
- Import into a different provider's storage
- Provider-specific UX for source/destination selection
- Details TBD
