import type { EncryptionStrategy } from 'strata-data-sync';
import { aesGcmEncrypt, aesGcmDecrypt } from 'strata-data-sync';
import { InvalidEncryptionKeyError } from '../invalid-key-error';

export class AesGcmEncryptionStrategy implements EncryptionStrategy<CryptoKey> {
  async encrypt(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
    return aesGcmEncrypt(data, key);
  }

  async decrypt(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
    try {
      return await aesGcmDecrypt(data, key);
    } catch {
      throw new InvalidEncryptionKeyError();
    }
  }
}
