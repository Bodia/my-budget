// Web Crypto API based security layer for Monobank Personal Token

function bufToHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): Uint8Array {
  const cleanHex = hex.trim();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

export async function generateEncryptionKey(): Promise<CryptoKey> {
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : null;
  if (!subtle) {
    throw new Error('Web Crypto API is not supported in this environment');
  }

  return await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportKeyToHex(key: CryptoKey): Promise<string> {
  const subtle = crypto.subtle;
  const raw = await subtle.exportKey('raw', key);
  return bufToHex(raw);
}

export async function importKeyFromHex(hex: string): Promise<CryptoKey> {
  const subtle = crypto.subtle;
  const buf = hexToBuf(hex);
  return await subtle.importKey(
    'raw',
    buf as BufferSource,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedPayload {
  cipherTextHex: string;
  ivHex: string;
}

export async function encryptToken(
  token: string,
  key: CryptoKey
): Promise<EncryptedPayload> {
  const subtle = crypto.subtle;
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits IV for AES-GCM
  const encoded = new TextEncoder().encode(token.trim());

  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoded as BufferSource
  );

  return {
    cipherTextHex: bufToHex(cipherBuffer),
    ivHex: bufToHex(iv),
  };
}

export async function decryptToken(
  cipherTextHex: string,
  ivHex: string,
  key: CryptoKey
): Promise<string> {
  const subtle = crypto.subtle;
  const iv = hexToBuf(ivHex);
  const cipherBuffer = hexToBuf(cipherTextHex);

  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    cipherBuffer as BufferSource
  );

  return new TextDecoder().decode(decryptedBuffer);
}

export function maskToken(token?: string | null): string {
  if (!token) return '—';
  const clean = token.trim();
  if (clean.length < 10) return '••••';
  return `${clean.slice(0, 5)}••••••••${clean.slice(-4)}`;
}

export function isValidTokenFormat(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const clean = token.trim();
  return clean.length >= 20 && !/\s/.test(clean);
}

const STORAGE_CIPHER_KEY = 'mybudget_mono_encrypted_token';
const STORAGE_IV_KEY = 'mybudget_mono_iv';
const STORAGE_DEVICE_KEY = 'mybudget_mono_dev_key';

export async function saveEncryptedToken(rawToken: string): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const key = await generateEncryptionKey();
  const hexKey = await exportKeyToHex(key);
  const encrypted = await encryptToken(rawToken, key);

  localStorage.setItem(STORAGE_DEVICE_KEY, hexKey);
  localStorage.setItem(STORAGE_CIPHER_KEY, encrypted.cipherTextHex);
  localStorage.setItem(STORAGE_IV_KEY, encrypted.ivHex);
}

export async function loadDecryptedToken(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const hexKey = localStorage.getItem(STORAGE_DEVICE_KEY);
  const cipherHex = localStorage.getItem(STORAGE_CIPHER_KEY);
  const ivHex = localStorage.getItem(STORAGE_IV_KEY);

  if (!hexKey || !cipherHex || !ivHex) return null;

  try {
    const key = await importKeyFromHex(hexKey);
    return await decryptToken(cipherHex, ivHex, key);
  } catch (err) {
    console.error('Failed to decrypt stored Monobank token:', err);
    return null;
  }
}

export function hasStoredToken(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  return Boolean(
    localStorage.getItem(STORAGE_CIPHER_KEY) &&
    localStorage.getItem(STORAGE_IV_KEY) &&
    localStorage.getItem(STORAGE_DEVICE_KEY)
  );
}

export function clearStoredToken(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.removeItem(STORAGE_DEVICE_KEY);
  localStorage.removeItem(STORAGE_CIPHER_KEY);
  localStorage.removeItem(STORAGE_IV_KEY);
}
