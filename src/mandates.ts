/**
 * Notice: portions of the design implemented in this file are the subject of pending
 * United States patent applications by Cadenza Labs. See ../PATENTS.md for the
 * §287(a) virtual-marking landing page and the applicable licence terms.
 *
 * AP2 mandate construction and verification.
 *
 * The three mandates form an unforgeable chain:
 *   user ─signs→ Intent  ─referenced-by→ Cart ─referenced-by→ Payment
 *
 * Each mandate is a W3C Verifiable Credential. The hash of an earlier mandate
 * is embedded in the credentialSubject of the next, making the chain
 * cryptographically auditable end-to-end.
 */

import { canonicalJson } from "./canonical.js";
import { sha256Hex, signEd25519, verifyEd25519 } from "./crypto.js";
import type {
  CartItem,
  CartMandate,
  CartMandateSubject,
  IntentMandate,
  IntentMandateSubject,
  MandateType,
  PaymentMandate,
  PaymentMandateSubject,
  Principal,
  VCProof,
  VerifiableCredential,
} from "./types.js";

const VC_CONTEXT = [
  "https://www.w3.org/2018/credentials/v1",
  "https://w3id.org/security/suites/ed25519-2020/v1",
  "https://cadenza.pay/credentials/v1",
];

function nonce(): string {
  // 16-hex-char nonce. For PoC; in production this would be a secure
  // cryptographic random value, not Math.random.
  return sha256Hex(`${Date.now()}-${Math.random()}-${process.hrtime.bigint()}`).slice(0, 16);
}

/**
 * Build a Verifiable Credential of the given mandate type, sign it with the
 * issuer's private key, and return the full VC including its proof.
 */
function makeVC<S extends object>(
  type: MandateType,
  issuer: Principal,
  subject: S,
): VerifiableCredential<S> {
  const issuanceDate = new Date().toISOString();
  const body = {
    "@context": VC_CONTEXT,
    type: ["VerifiableCredential", type] as ["VerifiableCredential", MandateType],
    issuer: issuer.did,
    issuanceDate,
    credentialSubject: subject,
  };
  const message = Buffer.from(canonicalJson(body), "utf8");
  const signature = signEd25519(message, issuer.privateKey);
  const proof: VCProof = {
    type: "Ed25519Signature2020",
    created: issuanceDate,
    proofPurpose: "assertionMethod",
    verificationMethod: `${issuer.did}#key-1`,
    signatureValue: signature.toString("base64"),
  };
  return { ...body, proof };
}

/**
 * Hash a full mandate VC (body + proof). This is the value that gets embedded
 * in downstream mandates and committed to the settlement transaction.
 */
export function mandateHash<S>(vc: VerifiableCredential<S>): string {
  return sha256Hex(canonicalJson(vc));
}

/**
 * Verify a mandate's signature using the issuer's public key.
 * Returns false if the signature is invalid, the public key doesn't match,
 * or the canonical body has been tampered with.
 */
export function verifyMandate<S>(
  vc: VerifiableCredential<S>,
  issuerPublicKey: Uint8Array,
): boolean {
  const { proof, ...body } = vc;
  const message = Buffer.from(canonicalJson(body), "utf8");
  const signature = Buffer.from(proof.signatureValue, "base64");
  try {
    return verifyEd25519(message, signature, issuerPublicKey);
  } catch {
    return false;
  }
}

export function createIntentMandate(
  user: Principal,
  agent: Principal,
  params: { spendCap: string; merchants?: string[]; expiresAt: string },
): IntentMandate {
  const subject: IntentMandateSubject = {
    user: user.did,
    agent: agent.did,
    scope: { spendCap: params.spendCap, merchants: params.merchants },
    expiresAt: params.expiresAt,
    nonce: nonce(),
  };
  return makeVC<IntentMandateSubject>("IntentMandate", user, subject);
}

export function createCartMandate(
  agent: Principal,
  intent: IntentMandate,
  params: {
    merchant: string;
    items: CartItem[];
    total: string;
    currency: string;
  },
): CartMandate {
  const subject: CartMandateSubject = {
    intentHash: mandateHash(intent),
    merchant: params.merchant,
    items: params.items,
    total: params.total,
    currency: params.currency,
    nonce: nonce(),
  };
  return makeVC<CartMandateSubject>("CartMandate", agent, subject);
}

export function createPaymentMandate(
  merchantAgent: Principal,
  cart: CartMandate,
  params: {
    chain: string;
    asset: string;
    amount: string;
    recipient: string;
    expiresAt: string;
  },
): PaymentMandate {
  const subject: PaymentMandateSubject = {
    cartHash: mandateHash(cart),
    chain: params.chain,
    asset: params.asset,
    amount: params.amount,
    recipient: params.recipient,
    expiresAt: params.expiresAt,
    nonce: nonce(),
  };
  return makeVC<PaymentMandateSubject>("PaymentMandate", merchantAgent, subject);
}
