const DEVICE_ID_PREFIX = 'strata-device-id';

export function getOrCreateDeviceId(appId: string): string {
  const storageKey = `${DEVICE_ID_PREFIX}:${appId}`;
  const existing = globalThis.localStorage?.getItem(storageKey);
  if (existing) return existing;

  const id = globalThis.crypto.randomUUID();
  globalThis.localStorage?.setItem(storageKey, id);
  return id;
}
