/**
 * Notice: portions of the design implemented in this file are the subject of pending
 * United States patent applications by Cadenza Labs. See ../PATENTS.md for the
 * §287(a) virtual-marking landing page and the applicable licence terms.
 *
 * settleOnChain orchestrates the on-chain commit of an AP2 mandate chain.
 *
 * It validates that the Cart references the Intent and the Payment references
 * the Cart (the cryptographic chain), builds the settlement transaction
 * (including the three mandate hashes), submits via the adapter, and returns
 * the result.
 */

import { mandateHash } from "./mandates.js";
import type {
  CartMandate,
  IntentMandate,
  PaymentMandate,
  SettlementResult,
} from "./types.js";
import type { KaspaAdapter, SettlementTxData } from "./adapter/types.js";

export interface MandateBundle {
  intent: IntentMandate;
  cart: CartMandate;
  payment: PaymentMandate;
}

export async function settleOnChain(
  adapter: KaspaAdapter,
  bundle: MandateBundle,
): Promise<SettlementResult> {
  const { intent, cart, payment } = bundle;

  const intentH = mandateHash(intent);
  const cartH = mandateHash(cart);
  const paymentH = mandateHash(payment);

  if (cart.credentialSubject.intentHash !== intentH) {
    throw new Error(
      `Mandate chain broken: Cart.intentHash (${cart.credentialSubject.intentHash}) ` +
        `!= hash(Intent) (${intentH})`,
    );
  }
  if (payment.credentialSubject.cartHash !== cartH) {
    throw new Error(
      `Mandate chain broken: Payment.cartHash (${payment.credentialSubject.cartHash}) ` +
        `!= hash(Cart) (${cartH})`,
    );
  }

  const p = payment.credentialSubject;
  const txData: SettlementTxData = {
    chain: p.chain,
    asset: p.asset,
    amount: p.amount,
    recipient: p.recipient,
    mandateHashes: { intent: intentH, cart: cartH, payment: paymentH },
  };

  const txHash = await adapter.submitSettlement(txData);

  return {
    txHash,
    chain: p.chain,
    asset: p.asset,
    amount: p.amount,
    recipient: p.recipient,
    mandateHashes: txData.mandateHashes,
    mandates: bundle,
  };
}
