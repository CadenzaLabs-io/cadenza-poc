/**
 * Cryptographic primitives — keypair generation, Ed25519 signing/verification,
 * and SHA-256 hashing. All primitives come from Node's built-in `crypto` module
 * (no third-party deps).
 */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
} from "node:crypto";
import type { Principal } from "./types.js";

export function sha256Hex(data: string | Uint8Array): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  return createHash("sha256").update(buf).digest("hex");
}

export function createPrincipal(): Principal {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pubDer = publicKey.export({ format: "der", type: "spki" });
  const privDer = privateKey.export({ format: "der", type: "pkcs8" });
  // Did-key-style identifier, simplified: prefix + hash-of-pubkey.
  // Real did:key uses base58btc + multicodec; for PoC, a hex slice is fine.
  const did = `did:key:z${sha256Hex(pubDer).slice(0, 32)}`;
  return {
    did,
    publicKey: new Uint8Array(pubDer),
    privateKey: new Uint8Array(privDer),
  };
}

export function signEd25519(message: Buffer, privateKeyDer: Uint8Array): Buffer {
  const key = createPrivateKey({
    key: Buffer.from(privateKeyDer),
    format: "der",
    type: "pkcs8",
  });
  return nodeSign(null, message, key);
}

export function verifyEd25519(
  message: Buffer,
  signature: Buffer,
  publicKeyDer: Uint8Array,
): boolean {
  const key = createPublicKey({
    key: Buffer.from(publicKeyDer),
    format: "der",
    type: "spki",
  });
  return nodeVerify(null, message, key, signature);
}
