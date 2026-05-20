// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import {
  bytesToHex,
  exportEd25519PublicKeyRaw,
  generateEd25519Keypair,
  hexToBytes,
  importEd25519PublicKeyRaw,
  sha256Bytes,
  sha256Hex,
  signEd25519,
  verifyEd25519,
} from '../src/crypto.js';

describe('crypto primitives', () => {
  it('SHA-256 matches the NIST test vector for "abc"', () => {
    // FIPS 180-4 §B.1 "abc" test vector.
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('SHA-256 over an empty string matches the standard vector', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('sha256Bytes returns 32-byte digest with matching hex', () => {
    const bytes = sha256Bytes('abc');
    expect(bytes.length).toBe(32);
    expect(bytesToHex(bytes)).toBe(sha256Hex('abc'));
  });

  it('hexToBytes/bytesToHex round-trip', () => {
    const hex = 'deadbeefcafebabe';
    expect(bytesToHex(hexToBytes(hex))).toBe(hex);
  });

  it('hexToBytes rejects odd-length input', () => {
    expect(() => hexToBytes('abc')).toThrow(TypeError);
  });

  it('hexToBytes rejects non-hex characters', () => {
    expect(() => hexToBytes('zz')).toThrow(TypeError);
  });

  it('Ed25519 sign-then-verify round-trips for the same key', () => {
    const key = generateEd25519Keypair();
    const message = sha256Bytes('hello');
    const sig = signEd25519(key.privateKey, message);
    expect(sig.length).toBe(64);
    expect(verifyEd25519(key.publicKey, message, sig)).toBe(true);
  });

  it('Ed25519 verification fails when the signature byte is mutated', () => {
    const key = generateEd25519Keypair();
    const message = sha256Bytes('hello');
    const sig = signEd25519(key.privateKey, message);
    sig[0] = (sig[0] ?? 0) ^ 0x01;
    expect(verifyEd25519(key.publicKey, message, sig)).toBe(false);
  });

  it('Ed25519 verification fails when the message is mutated', () => {
    const key = generateEd25519Keypair();
    const message = sha256Bytes('hello');
    const sig = signEd25519(key.privateKey, message);
    const mutated = sha256Bytes('hellp'); // different message
    expect(verifyEd25519(key.publicKey, mutated, sig)).toBe(false);
  });

  it('Ed25519 verification fails when verifying with the wrong key', () => {
    const key1 = generateEd25519Keypair();
    const key2 = generateEd25519Keypair();
    const message = sha256Bytes('hello');
    const sig = signEd25519(key1.privateKey, message);
    expect(verifyEd25519(key2.publicKey, message, sig)).toBe(false);
  });

  it('exports raw 32-byte Ed25519 public key and imports it back', () => {
    const key = generateEd25519Keypair();
    const raw = exportEd25519PublicKeyRaw(key.publicKey);
    expect(raw.length).toBe(32);
    const reimported = importEd25519PublicKeyRaw(raw);
    const message = sha256Bytes('round-trip');
    const sig = signEd25519(key.privateKey, message);
    expect(verifyEd25519(reimported, message, sig)).toBe(true);
  });

  it('importEd25519PublicKeyRaw rejects wrong-length input', () => {
    expect(() => importEd25519PublicKeyRaw(new Uint8Array(16))).toThrow(TypeError);
  });

  it('keyId equals sha256 of raw public key', () => {
    const key = generateEd25519Keypair();
    expect(key.keyId).toBe(sha256Hex(key.publicKeyRaw));
  });
});
