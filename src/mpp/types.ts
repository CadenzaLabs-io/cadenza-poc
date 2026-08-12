// MPP payment-token — public type surface.
//
// Interface-only scaffold ahead of the v0.5 runtime (Q3 2026).
// Ships alongside the x402 Facilitator reference implementation.
//
// Spec: https://cadenzalabs.dev/docs

import type { SettlementAsset } from "../x402/types.js";

/** Issuer-declared intent that seeds an MPP payment-token construction. */
export interface MppIssuerIntent {
  issuer: string;
  asset: SettlementAsset;
  amount: string;
  recipient: string;
  purpose: string;
  nonce: string;
  expiresAt: string;
}

/** A constructed MPP payment-token, canonically serialised and issuer-signed. */
export interface MppPaymentToken {
  intent: MppIssuerIntent;
  canonicalHash: string;
  issuerSignature: string;
  version: 1;
}

/** Result of verifying an MPP payment-token. */
export interface MppVerifyResult {
  valid: boolean;
  reason?: string;
}

/** Settlement receipt after an MPP token is settled on-chain. */
export interface MppSettlementReceipt {
  tokenHash: string;
  transactionHash: string;
  blockDaaScore?: bigint;
  settledAt: string;
  asset: SettlementAsset;
  amount: string;
}

/** MPP construction and settlement surface. */
export interface MppPaymentTokenSurface {
  /** Deterministic token construction from an issuer intent. */
  construct(intent: MppIssuerIntent, issuerPrivateKey: Uint8Array): Promise<MppPaymentToken>;

  /** Signature verification against issuer authority. */
  verify(token: MppPaymentToken, issuerPublicKey: Uint8Array): Promise<MppVerifyResult>;

  /** Settle a verified payment-token through the KRC-20 covenant suite. */
  settle(token: MppPaymentToken): Promise<MppSettlementReceipt>;

  /** Reconciliation helper — look up settlement by token hash. */
  reconcile(tokenHash: string): Promise<MppSettlementReceipt | null>;
}
