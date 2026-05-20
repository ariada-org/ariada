// SPDX-License-Identifier: EUPL-1.2
//
// Cryptographic primitives — thin wrappers over the Node `node:crypto`
// module so the rest of the package speaks in hex strings + Uint8Arrays.
//
// Hash:      SHA-256 (FIPS 180-4)
// Signature: Ed25519 (RFC 8032) — deterministic, 64-byte signature,
//            128-bit security level, native in Node since 12.0.

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign as nodeSign,
  verify as nodeVerify,
  type KeyObject,
} from 'node:crypto';

/**
 * Compute SHA-256 over UTF-8-encoded input. Returns lowercase 64-char hex.
 */
export function sha256Hex(input: string | Uint8Array): string {
  const h = createHash('sha256');
  h.update(typeof input === 'string' ? Buffer.from(input, 'utf8') : input);
  return h.digest('hex');
}

/**
 * SHA-256 over input, returning the raw 32-byte digest.
 */
export function sha256Bytes(input: string | Uint8Array): Uint8Array {
  const h = createHash('sha256');
  h.update(typeof input === 'string' ? Buffer.from(input, 'utf8') : input);
  return new Uint8Array(h.digest());
}

/**
 * Convert hex (any case) to Uint8Array. Throws on odd-length or non-hex.
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new TypeError(`hex string has odd length: ${hex.length}`);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new TypeError(`hex string contains non-hex character at ${i * 2}`);
    }
    out[i] = byte;
  }
  return out;
}

/**
 * Convert bytes to lowercase hex.
 */
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] as number;
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Cryptographically-strong random bytes.
 */
export function getRandomBytes(n: number): Uint8Array {
  return new Uint8Array(randomBytes(n));
}

/**
 * Ed25519 keypair as the hex/bytes shapes the rest of the package uses.
 *
 * `keyId` is `sha256Hex(publicKey)` per the AIAS signing-key-id convention.
 */
export interface Ed25519Keypair {
  privateKey: KeyObject;
  publicKey: KeyObject;
  publicKeyRaw: Uint8Array;
  keyId: string;
}

/**
 * Generate a fresh Ed25519 keypair.
 */
export function generateEd25519Keypair(): Ed25519Keypair {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicKeyRaw = exportEd25519PublicKeyRaw(publicKey);
  return {
    privateKey,
    publicKey,
    publicKeyRaw,
    keyId: sha256Hex(publicKeyRaw),
  };
}

/**
 * Extract the raw 32-byte Ed25519 public key from a Node KeyObject. Node's
 * SPKI export wraps the raw key in an ASN.1 prefix; we strip it.
 */
export function exportEd25519PublicKeyRaw(key: KeyObject): Uint8Array {
  const spki = key.export({ format: 'der', type: 'spki' });
  // SPKI for Ed25519 is 44 bytes: 12-byte fixed prefix + 32-byte raw key.
  if (spki.length !== 44) {
    throw new Error(`unexpected Ed25519 SPKI length: ${spki.length}`);
  }
  return new Uint8Array(spki.subarray(12));
}

/**
 * Reconstruct an Ed25519 public KeyObject from raw 32-byte key bytes.
 */
export function importEd25519PublicKeyRaw(raw: Uint8Array): KeyObject {
  if (raw.length !== 32) {
    throw new TypeError(`Ed25519 public key must be 32 bytes (got ${raw.length})`);
  }
  // Prepend the standard SPKI prefix for Ed25519.
  const spkiPrefix = Buffer.from([
    0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
  ]);
  const spki = Buffer.concat([spkiPrefix, Buffer.from(raw)]);
  return createPublicKey({ key: spki, format: 'der', type: 'spki' });
}

/**
 * Sign a raw byte sequence (typically the 32-byte SHA-256 entry hash) with
 * an Ed25519 private key. Returns the 64-byte signature.
 */
export function signEd25519(privateKey: KeyObject, message: Uint8Array): Uint8Array {
  // Ed25519 uses null algorithm parameter (it hashes internally).
  return new Uint8Array(nodeSign(null, Buffer.from(message), privateKey));
}

/**
 * Verify an Ed25519 signature over `message` using `publicKey`. Returns
 * true on valid signature, false on any verification failure (mismatched
 * signature, wrong key, malformed input).
 */
export function verifyEd25519(
  publicKey: KeyObject,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  try {
    return nodeVerify(null, Buffer.from(message), publicKey, Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Re-export `createPrivateKey` for callers that need to load PKCS#8 keys
 * from disk / env without depending on `node:crypto` directly.
 */
export { createPrivateKey, createPublicKey };
