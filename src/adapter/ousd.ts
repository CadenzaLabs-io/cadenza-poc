/**
 * OusdKrc20Adapter — STUB for production OUSD-KRC20 settlement on Kaspa L1.
 *
 * OUSD is the primary settlement asset target for Cadenza. This adapter is
 * stubbed pending canonical OUSD-KRC20 issuance on Kaspa L1 mainnet.
 *
 * Intended implementation (Toccata / L1-native):
 *   - Connect to a Kaspa L1 node exposing native KRC-20 semantics
 *   - Construct an OUSD-KRC20 transfer with mandate hashes committed either
 *     via a CadenzaMandateAnchor SilverScript covenant OR in the transaction's
 *     payload trailer (Toccata payload field)
 *   - Submit, wait for L1 finality (~1s), return tx hash
 *
 * The adapter interface is stablecoin-agnostic; this class is a thin
 * configuration wrapper that pins the asset identifier and RPC endpoint.
 * The USDT-KRC20 parallel/backup track uses a sibling adapter with the same
 * shape but a different asset identifier and (eventually) issuer-specific
 * compliance hooks.
 */

import type { KaspaAdapter, SettlementTxData } from "./types.js";

export interface OusdAdapterOptions {
  /** Kaspa L1 JSON-RPC endpoint. */
  rpcUrl: string;
  /** Hex-encoded private key for the settlement account. */
  privateKey: string;
  /** Canonical OUSD-KRC20 token identifier on Kaspa L1. */
  ousdKrc20TokenId: string;
  /** Optional Cadenza mandate anchor covenant address. */
  mandateAnchorAddress?: string;
}

export class OusdKrc20Adapter implements KaspaAdapter {
  constructor(_opts: OusdAdapterOptions) {
    // not implemented — awaiting OUSD-KRC20 mainnet issuance
  }

  async submitSettlement(_tx: SettlementTxData): Promise<string> {
    throw new Error(
      "OusdKrc20Adapter not yet implemented — awaiting OUSD-KRC20 mainnet issuance. " +
        "Use MockKaspaAdapter for the PoC.",
    );
  }

  async getTransaction(_txHash: string): Promise<SettlementTxData | null> {
    throw new Error(
      "OusdKrc20Adapter not yet implemented — awaiting OUSD-KRC20 mainnet issuance. " +
        "Use MockKaspaAdapter for the PoC.",
    );
  }
}
