// x402 Facilitator — public type surface.
//
// Interface-only scaffold ahead of the v0.4 runtime (Q3 2026).
// Ships alongside the MPP reference implementation.
//
// Spec: https://cadenzalabs.dev/docs

/** The payment scheme identifier for Cadenza's x402 implementation on Kaspa. */
export const CADENZA_KRC20_SCHEME = "cadenza-krc20" as const;

/** Supported settlement assets. OUSD-KRC20 is primary; USDT-KRC20 is parallel-track. */
export type SettlementAsset = "OUSD-KRC20" | "USDT-KRC20";

/** A payment payload as defined by the x402 protocol, specialised for Cadenza. */
export interface X402PaymentPayload {
  scheme: typeof CADENZA_KRC20_SCHEME;
  asset: SettlementAsset;
  amount: string;
  recipient: string;
  nonce: string;
  expiresAt: string;
  signature: string;
}

/** Result of a verify-only call. */
export interface X402VerifyResult {
  valid: boolean;
  reason?: string;
  requiresBatching?: boolean;
}

/** Settlement receipt returned after successful on-chain submission. */
export interface X402SettlementReceipt {
  transactionHash: string;
  blockDaaScore?: bigint;
  settledAt: string;
  asset: SettlementAsset;
  amount: string;
  facilitator: string;
}

/** Facilitator surface — HTTP endpoints described in the spec map onto these methods. */
export interface X402Facilitator {
  /** Validate a payment payload without submitting it on-chain. */
  verify(payload: X402PaymentPayload): Promise<X402VerifyResult>;

  /** Verify and submit; return the settlement receipt. */
  settle(payload: X402PaymentPayload): Promise<X402SettlementReceipt>;

  /** Look up a settlement by hash for resource-server-initiated reconciliation. */
  reconcile(transactionHash: string): Promise<X402SettlementReceipt | null>;
}
