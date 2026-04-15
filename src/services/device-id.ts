export function getOrCreateDeviceId(storageKey: string): string {
  const existing = globalThis.localStorage?.getItem(storageKey);
  if (existing) return existing;

  const id = globalThis.crypto.randomUUID();
  globalThis.localStorage?.setItem(storageKey, id);
  return id;
}
