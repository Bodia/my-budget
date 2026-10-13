import { describe, it, expect } from 'vitest';
import {
  generateEncryptionKey,
  exportKeyToHex,
  importKeyFromHex,
  encryptToken,
  decryptToken,
  maskToken,
  isValidTokenFormat,
} from '../src/services/monobank/security';

describe('Monobank Security & Web Crypto (AES-GCM)', () => {
  it('generates a valid CryptoKey and can export/import it via hex', async () => {
    const key = await generateEncryptionKey();
    expect(key).toBeDefined();
    expect(key.algorithm.name).toBe('AES-GCM');

    const hex = await exportKeyToHex(key);
    expect(typeof hex).toBe('string');
    expect(hex.length).toBe(64); // 256 bits = 32 bytes = 64 hex chars

    const imported = await importKeyFromHex(hex);
    expect(imported).toBeDefined();
    expect(imported.algorithm.name).toBe('AES-GCM');
  });

  it('encrypts and decrypts a personal token successfully', async () => {
    const key = await generateEncryptionKey();
    const rawToken = 'u2_oB81jK992xPqLmZ001A83xYY9192abc';

    const encrypted = await encryptToken(rawToken, key);
    expect(encrypted.cipherTextHex).toBeDefined();
    expect(encrypted.ivHex).toBeDefined();
    expect(encrypted.ivHex.length).toBe(24); // 12 bytes IV = 24 hex chars
    expect(encrypted.cipherTextHex).not.toBe(rawToken);

    const decrypted = await decryptToken(encrypted.cipherTextHex, encrypted.ivHex, key);
    expect(decrypted).toBe(rawToken);
  });

  it('fails decryption when using an incorrect key or corrupted IV', async () => {
    const key1 = await generateEncryptionKey();
    const key2 = await generateEncryptionKey();
    const rawToken = 'u2_secret_token_1234567890';

    const encrypted = await encryptToken(rawToken, key1);

    // Wrong key
    await expect(
      decryptToken(encrypted.cipherTextHex, encrypted.ivHex, key2)
    ).rejects.toThrow();

    // Corrupted IV
    const corruptedIv = '00'.repeat(12);
    await expect(
      decryptToken(encrypted.cipherTextHex, corruptedIv, key1)
    ).rejects.toThrow();
  });

  it('correctly masks tokens for UI display', () => {
    expect(maskToken('u2_oB81jK992xPqLmZ001A83xYY9192')).toBe('u2_oB••••••••9192');
    expect(maskToken('short')).toBe('••••');
    expect(maskToken('')).toBe('—');
  });

  it('validates token format', () => {
    expect(isValidTokenFormat('u2_oB81jK992xPqLmZ001A83xYY9192')).toBe(true);
    expect(isValidTokenFormat('   u2_valid_token_string_with_length   ')).toBe(true);
    expect(isValidTokenFormat('too_short')).toBe(false);
    expect(isValidTokenFormat('')).toBe(false);
    expect(isValidTokenFormat(null as any)).toBe(false);
  });
});
