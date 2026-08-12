/**
 * KasplexEvmAdapter — STUB for production Kasplex L2 settlement.
 *
 * Not implemented in v0.1 of the PoC. The intended implementation:
 *   - Use ethers.js to connect to a Kasplex JSON-RPC endpoint
 *   - Construct a USDT-KRC20 transfer call (ERC-20 transfer ABI)
 *   - Append mandate hash commitments via a CadenzaMandateAnchor contract
 *     OR encode them in the transaction's data trailer (Kasplex EVM supports
 *     unused-data fields up to a limit)
 *   - Submit, wait for inclusion, return tx hash
 *
 * Phase 2 (post-Toccata) adds a NativeL1Adapter using SilverScript covenants
 * for compliance-enforced settlement.
 */

import type { KaspaAdapter, SettlementTxData } from "./types.js";

export interface KasplexAdapterOptions {
  rpcUrl: string;
  privateKey: string;
  usdtKrc20Address: string;
  mandateAnchorAddress?: string;
}

export class KasplexEvmAdapter implements KaspaAdapter {
  constructor(_opts: KasplexAdapterOptions) {
    // not implemented in v0.1
  }

  async submitSettlement(_tx: SettlementTxData): Promise<string> {
    throw new Error(
      "KasplexEvmAdapter not implemented in v0.1. Use MockKaspaAdapter for the PoC.",
    );
  }

  async getTransaction(_txHash: string): Promise<SettlementTxData | null> {
    throw new Error(
      "KasplexEvmAdapter not implemented in v0.1. Use MockKaspaAdapter for the PoC.",
    );
  }
}
