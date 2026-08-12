/**
 * Core types: principals, AP2 mandate subjects, W3C Verifiable Credential envelopes,
 * and the settlement result returned by the Cadenza SDK.
 */

export interface Principal {
  did: string;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface IntentMandateSubject {
  user: string;
  agent: string;
  scope: {
    spendCap: string;
    merchants?: string[];
  };
  expiresAt: string;
  nonce: string;
}

export interface CartItem {
  id: string;
  price: string;
  quantity?: number;
}

export interface CartMandateSubject {
  intentHash: string;
  merchant: string;
  items: CartItem[];
  total: string;
  currency: string;
  nonce: string;
}

export interface PaymentMandateSubject {
  cartHash: string;
  chain: string;
  asset: string;
  amount: string;
  recipient: string;
  expiresAt: string;
  nonce: string;
}

export type MandateType =
  | "IntentMandate"
  | "CartMandate"
  | "PaymentMandate"
  | "StreamingIntentMandate"
  | "StreamMandate"
  | "StreamSettlementMandate";

/* ─── Streaming mandate subjects ─────────────────────────────────── */

export interface StreamingIntentMandateSubject {
  user: string;
  agent: string;
  provider: string;
  rate: {
    unit: string;          // e.g. "token", "second", "call", "byte"
    pricePerUnit: string;  // in asset units
  };
  spendCap: string;        // max total spend over the session
  asset: string;           // e.g. "USDT-KRC20"
  expiresAt: string;
  nonce: string;
}

export interface StreamMandateSubject {
  streamingIntentHash: string;
  sequenceNumber: number;       // monotonic per session
  cumulativeUnits: string;
  cumulativeCost: string;
  timestamp: string;
  nonce: string;
}

export interface StreamSettlementMandateSubject {
  streamingIntentHash: string;
  streamMandateHash: string;
  fromSequence: number;
  toSequence: number;
  chain: string;
  asset: string;
  amount: string;            // incremental amount being settled now
  recipient: string;
  cumulativeUnits: string;
  cumulativeCost: string;
  expiresAt: string;
  nonce: string;
}

export interface VCProof {
  type: "Ed25519Signature2020";
  created: string;
  proofPurpose: "assertionMethod";
  verificationMethod: string;
  signatureValue: string;
}

export interface VerifiableCredential<S> {
  "@context": string[];
  type: ["VerifiableCredential", MandateType];
  issuer: string;
  issuanceDate: string;
  credentialSubject: S;
  proof: VCProof;
}

export type IntentMandate = VerifiableCredential<IntentMandateSubject>;
export type CartMandate = VerifiableCredential<CartMandateSubject>;
export type PaymentMandate = VerifiableCredential<PaymentMandateSubject>;
export type StreamingIntentMandate = VerifiableCredential<StreamingIntentMandateSubject>;
export type StreamMandate = VerifiableCredential<StreamMandateSubject>;
export type StreamSettlementMandate = VerifiableCredential<StreamSettlementMandateSubject>;

export interface StreamSettlementResult {
  txHash: string;
  chain: string;
  asset: string;
  amount: string;              // incremental amount settled in this transaction
  cumulativeAmount: string;    // total settled across this session
  fromSequence: number;
  toSequence: number;
  mandateHashes: {
    streamingIntent: string;
    streamMandate: string;
    settlement: string;
  };
}

export interface StreamSessionSummary {
  sessionId: string;
  totalEvents: number;
  totalUnits: string;
  totalCost: string;
  settledAmount: string;
  unsettledAmount: string;
  settlements: StreamSettlementResult[];
}

export interface MandateHashes {
  intent: string;
  cart: string;
  payment: string;
}

export interface SettlementResult {
  txHash: string;
  chain: string;
  asset: string;
  amount: string;
  recipient: string;
  mandateHashes: MandateHashes;
  mandates: {
    intent: IntentMandate;
    cart: CartMandate;
    payment: PaymentMandate;
  };
}
