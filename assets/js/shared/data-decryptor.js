export class CryptoDataError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = 'CryptoDataError';
    this.code = code;
    this.detail = detail;
  }
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export function base64ToBytes(value) {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    throw new CryptoDataError('CRYPTO_004', 'Payload base64 inválido.');
  }
}

export function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') throw new CryptoDataError('CRYPTO_004', 'Envelope criptográfico inválido.');
  if (envelope.version !== 1 || envelope.algorithm !== 'AES-GCM' || envelope.kdf !== 'PBKDF2-SHA-256') {
    throw new CryptoDataError('CRYPTO_004', 'Versão ou algoritmo criptográfico incompatível.');
  }
  for (const key of ['salt', 'iv', 'ciphertext']) {
    if (!envelope[key]) throw new CryptoDataError('CRYPTO_004', `Envelope sem campo ${key}.`);
  }
}

export async function deriveAesKey(password, saltBase64, extractable = true) {
  const keyMaterial = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: base64ToBytes(saltBase64), iterations: 310000 },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['decrypt']
  );
}

export async function importAesKey(rawKeyBase64) {
  return crypto.subtle.importKey('raw', base64ToBytes(rawKeyBase64), { name: 'AES-GCM' }, true, ['decrypt']);
}

export async function exportAesKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return bytesToBase64(new Uint8Array(raw));
}

export async function decryptEnvelopeText(envelope, key, expectedAad = null) {
  validateEnvelope(envelope);
  try {
    const aad = expectedAad || envelope.aad || '';
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(envelope.iv), additionalData: textEncoder.encode(aad) },
      key,
      base64ToBytes(envelope.ciphertext)
    );
    return textDecoder.decode(plaintext);
  } catch {
    throw new CryptoDataError('CRYPTO_003', 'Senha inválida ou payload corrompido.');
  }
}

export function parseDecryptedJson(text, path) {
  try {
    return JSON.parse(text);
  } catch {
    throw new CryptoDataError('CRYPTO_005', `Arquivo descriptografado não é JSON válido: ${path}`);
  }
}
