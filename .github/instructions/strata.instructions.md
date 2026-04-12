---
description: "Use when working with strata-data-sync or strata-adapters. Covers data layer architecture, storage adapters, tenant strategy, and API reference."
applyTo: "src/services/**"
---

# Strata Data Sync Guidelines

## Packages

- `strata-data-sync` (v0.1.6) — offline-first reactive data sync framework
- `strata-adapters` (v0.1.2) — external-service adapters and transforms
- Both packages are owned by this project's author — request upstream changes rather than patching locally

## Architecture

- In-memory Map is the source of truth; all reads are synchronous
- Three-phase sync: hydrate on load → periodic local persist → manual/scheduled cloud sync
- Conflict resolution via HLC (Hybrid Logical Clock) with tombstone support
- Full RxJS Observable support for reactivity

## Key Types

```ts
// Keys strata passes to StorageAdapter
// No tenant:  "__tenants"
// Per tenant:  "__strata", "__tenant_prefs", "<entity>.<partition>" (e.g. "task.default")

type StorageAdapter = {
  read(tenant: Tenant | undefined, key: string): Promise<Uint8Array | null>
  write(tenant: Tenant | undefined, key: string, data: Uint8Array): Promise<void>
  delete(tenant: Tenant | undefined, key: string): Promise<boolean>
  deriveTenantId?(meta: Record<string, unknown>): string
}

type Tenant = {
  id: string; name: string; encrypted: boolean
  meta: Readonly<Record<string, unknown>>
  createdAt: Date; updatedAt: Date
}

type StrataConfig = {
  appId: string
  entities: ReadonlyArray<EntityDefinition<any>>
  localAdapter: StorageAdapter
  cloudAdapter?: StorageAdapter
  deviceId: string
  migrations?: ReadonlyArray<BlobMigration>
  encryptionService?: EncryptionService
  options?: StrataOptions
}
```

## strata-adapters Exports

| Export | Purpose |
|---|---|
| `LocalStorageAdapter` | `StorageAdapter` backed by `localStorage` (with optional prefix) |
| `GoogleDriveAdapter` | `StorageAdapter` backed by Google Drive API v3 |
| `withGzip(adapter)` | Wraps adapter with gzip compression |
| `withRetry(adapter, opts?)` | Wraps adapter with automatic retries |
| `AesGcmEncryptionStrategy` | AES-GCM encryption (Web Crypto) |
| `Pbkdf2EncryptionService` | PBKDF2 key derivation + pluggable encryption strategy |

## Lifecycle

```ts
const strata = new Strata(config)
await strata.tenants.open(tenantId)
strata.repo(entityDef).save({ ... })
await strata.dispose()
```

## Repository API

```ts
// Collection entities
repo.get(id): (T & BaseEntity) | undefined
repo.save(entity): string
repo.saveMany(entities): string[]
repo.delete(id): boolean
repo.deleteMany(ids): void
repo.query(opts?): ReadonlyArray<T & BaseEntity>
repo.observe(id): Observable<(T & BaseEntity) | undefined>
repo.observeQuery(opts?): Observable<ReadonlyArray<T & BaseEntity>>

// Singleton entities (defineEntity with { keyStrategy: 'singleton' })
repo.get(): (T & BaseEntity) | undefined
repo.save(entity): void
repo.delete(): boolean
repo.observe(): Observable<(T & BaseEntity) | undefined>
```

## Observe Channels

```ts
strata.observe('entity'): Observable<EntityEvent>           // all entity changes
strata.observe('entity', 'task'): Observable<EntityEvent>   // filtered by name
strata.observe('sync'): Observable<SyncEvent>               // sync lifecycle
strata.observe('dirty'): Observable<boolean>                // unsaved changes
strata.observe('tenant'): Observable<Tenant | undefined>    // tenant switches
```

## Cloud Adapter Design Rules

- Adapters must be dumb — no business logic, just read/write/delete
- Tenant metadata (`tenant.meta`) configures storage location (folder, space, etc.)
- Always prefix filenames with `tenant.id` when tenant is provided to avoid key collisions
- For shared storage (e.g. shared Drive folder), implement `deriveTenantId` on the cloud adapter to produce deterministic tenant IDs from metadata — the adapter owns the meta schema so it owns the derivation
- Compose adapters with `withGzip` / `withRetry` from `strata-adapters` — don't add retry or compression inside custom adapters
- Cache file-ID lookups in memory to minimize API calls

## GoogleDriveAdapter

- Constructor: `new GoogleDriveAdapter(getAccessToken: () => Promise<string>)`
- Tenant meta schema: `{ space: "appDataFolder" | "drive" | "sharedWithMe", folderId?: string }`
- `space` is mandatory — no defaults
- `folderId` required for `drive` and `sharedWithMe` spaces
- Implements `deriveTenantId` using `meta.folderId` — deterministic across users sharing a folder
- Uses `compositeKey(tenant, key)` from `strata-data-sync` for filenames
- Caches Drive file IDs in memory

## App Integration

- Strata initializes after login — cloud adapter chosen by login provider (`google` → `GoogleDriveAdapter`)
- Local adapter: `LocalStorageAdapter`
- Device ID: UUID persisted in `localStorage` (`src/services/utils/device.ts`)
- Providers (in `App.tsx`): `AuthProvider` → `StrataProvider` → `TenantProvider`
- Providers manage state only — no routing/redirects
- Route guards (`RequireAuth`, `RequireTenant`) handle access control in `router.tsx`
- Tenant ID is in the URL: `/t/:tenantId/...`
- `TenantProvider` reads `:tenantId` from URL and loads/unloads tenant

## Conventions

- Adapter implementations live in `strata-adapters` package — not in this project
- Entity definitions go in `src/services/entities/`
- Domain services using strata go in `src/services/core/`
- Service utilities go in `src/services/utils/`
- Keep `services/` free of React — pure TypeScript only
