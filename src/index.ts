/**
 * Cadenza SDK — public surface.
 *
 * Designed to deliver the "seven lines of code" promise: instantiate, create
 * principals, settle. The class hides the mandate construction, hashing,
 * signing, and chain submission behind a single `settle()` call.
 */

import { MockKaspaAdapter } from "./adapter/mock.js";
import type { KaspaAdapter } from "./adapter/types.js";
import { createPrincipal as cryptoCreatePrincipal } from "./crypto.js";
import {
  createCartMandate,
  createIntentMandate,
  createPaymentMandate,
  mandateHash,
  verifyMandate,
} from "./mandates.js";
import { settleOnChain } from "./settlement.js";
import type { CartItem, Principal, SettlementResult } from "./types.js";

export interface CadenzaOptions {
  /** Either the literal string "mock" or an instance of a KaspaAdapter. */
  adapter?: "mock" | KaspaAdapter;
  /** Settlement chain identifier (e.g. "kasplex-l2", "kaspa-mainnet"). */
  chain?: string;
}

export interface SettleParams {
  user: Principal;
  agent: Principal;
  /** Merchant principal — its keypair signs the Payment Mandate. */
  merchant: Principal;
  intent: {
    spendCap: string;
    merchants?: string[];
    expiresAfterMs?: number;
  };
  cart: {
    items: CartItem[];
    currency?: string;
  };
  payment: {
    asset: string;
    amount: string;
    recipient?: string;
  };
}

export class Cadenza {
  private adapter: KaspaAdapter;
  private chain: string;

  constructor(opts: CadenzaOptions = {}) {
    this.adapter =
      !opts.adapter || opts.adapter === "mock" ? new MockKaspaAdapter() : opts.adapter;
    this.chain = opts.chain ?? "kasplex-l2";
  }

  createPrincipal(): Principal {
    return cryptoCreatePrincipal();
  }

  async settle(params: SettleParams): Promise<SettlementResult> {
    const expiresAt = new Date(
      Date.now() + (params.intent.expiresAfterMs ?? 24 * 60 * 60 * 1000),
    ).toISOString();

    const intent = createIntentMandate(params.user, params.agent, {
      spendCap: params.intent.spendCap,
      merchants: params.intent.merchants,
      expiresAt,
    });

    const total = params.cart.items
      .reduce(
        (sum, item) => sum + Number.parseFloat(item.price) * (item.quantity ?? 1),
        0,
      )
      .toFixed(2);

    const cart = createCartMandate(params.agent, intent, {
      merchant: params.merchant.did,
      items: params.cart.items,
      total,
      currency: params.cart.currency ?? "USD",
    });

    const payment = createPaymentMandate(params.merchant, cart, {
      chain: this.chain,
      asset: params.payment.asset,
      amount: params.payment.amount,
      recipient: params.payment.recipient ?? params.merchant.did,
      expiresAt,
    });

    return settleOnChain(this.adapter, { intent, cart, payment });
  }
}

export { mandateHash, verifyMandate };
export {
  StreamSession,
  createStreamingIntentMandate,
  createStreamMandate,
  createStreamSettlementMandate,
} from "./streaming.js";
export type {
  StreamSessionParams,
  SettlementTrigger,
} from "./streaming.js";
export type {
  CartMandate,
  IntentMandate,
  MandateHashes,
  PaymentMandate,
  Principal,
  SettlementResult,
  StreamingIntentMandate,
  StreamMandate,
  StreamSettlementMandate,
  StreamSettlementResult,
  StreamSessionSummary,
  VerifiableCredential,
} from "./types.js";
export { MockKaspaAdapter } from "./adapter/mock.js";
export { OusdKrc20Adapter } from "./adapter/ousd.js";
export { KasplexEvmAdapter } from "./adapter/kasplex.js";
export { NativeKaspaAdapter } from "./adapter/native-kaspa.js";
export type { NativeKaspaAdapterOptions } from "./adapter/native-kaspa.js";
