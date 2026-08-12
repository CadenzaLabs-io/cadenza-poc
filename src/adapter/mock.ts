/**
 * MockKaspaAdapter — in-memory simulation of a Kaspa settlement endpoint.
 *
 * Models the public surface of submit/retrieve. Latency simulates the
 * ~1-second finality of Kaspa (compressed to 50ms here so tests stay fast).
 * For production: replace with a KasplexEvmAdapter (ethers.js) or a native
 * L1 adapter (post-Toccata).
 */

import { canonicalJson } from "../canonical.js";
import { sha256Hex } from "../crypto.js";
import type { KaspaAdapter, SettlementTxData } from "./types.js";

export class MockKaspaAdapter implements KaspaAdapter {
  private store = new Map<string, SettlementTxData>();
  private confirmationDelayMs: number;

  constructor(opts: { confirmationDelayMs?: number } = {}) {
    this.confirmationDelayMs = opts.confirmationDelayMs ?? 50;
  }

  async submitSettlement(tx: SettlementTxData): Promise<string> {
    await new Promise((r) => setTimeout(r, this.confirmationDelayMs));
    const txHash = "0x" + sha256Hex(canonicalJson(tx));
    this.store.set(txHash, tx);
    return txHash;
  }

  async getTransaction(txHash: string): Promise<SettlementTxData | null> {
    return this.store.get(txHash) ?? null;
  }
}
