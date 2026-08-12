/**
 * KaspaAdapter is the chain-facing boundary of the SDK. Production adapters
 * (Kasplex L2 EVM, native Kaspa L1 post-Toccata) implement this interface;
 * the mock adapter ships with the PoC for offline demos and tests.
 */

import type { MandateHashes } from "../types.js";

export interface SettlementTxData {
  chain: string;
  asset: string;
  amount: string;
  recipient: string;
  mandateHashes: MandateHashes;
}

export interface KaspaAdapter {
  submitSettlement(tx: SettlementTxData): Promise<string>;
  getTransaction(txHash: string): Promise<SettlementTxData | null>;
}
