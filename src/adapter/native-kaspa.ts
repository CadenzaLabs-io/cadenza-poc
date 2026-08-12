/**
 * NativeKaspaAdapter — v0.1 Kaspa L1 adapter for Cadenza settlement.
 *
 * SCOPE (v0.1):
 *   - Real testnet-10 KAS transfers
 *   - Mandate hashes committed to transaction payload
 *   - Public wRPC endpoint via Resolver auto-discovery
 *   - Returns real testnet tx hash resolvable on explorer.kaspa.org
 *
 * NOT YET (v0.2+):
 *   - KRC-20 transfers (gated on KRC-20 SDK maturity + a test token)
 *   - Mainnet deployment
 *   - Custom RPC endpoint / private node routing
 *   - Multi-recipient batched settlement (Cadenza Stream integration point)
 *
 * TRUTH-IN-LABELING:
 *   v0.1 settles real KAS on testnet-10 as proof-of-network-integration. The
 *   `asset` field on the incoming SettlementTxData is preserved for the
 *   receipt but NOT enforced at settlement — a "USDT-KRC20" or "OUSD-KRC20"
 *   mandate in v0.1 still settles as KAS on testnet. Demo UI must reflect
 *   this. The v0.2 KRC-20 adapter is a drop-in replacement of this class.
 */

import type { KaspaAdapter, SettlementTxData } from "./types.js";

// Runtime-imported at first use so the WASM heap is only initialized when
// the native adapter is actually instantiated. Keeps mock-only test runs
// fast and avoids WASM init cost when the adapter is never used.
//
// The package ships without an "exports" field so we import the file
// directly. WASM initialization happens on first use via the default
// export (`__wbg_init`).
type KaspaWasmModule = any;
let wasmModule: KaspaWasmModule | null = null;

async function loadWasm(): Promise<KaspaWasmModule> {
  if (wasmModule) return wasmModule;
  // Node < 22 lacks a global WebSocket; the WASM needs one for wRPC. Polyfill
  // with the `websocket` package's W3C-compatible client before WASM init.
  if (typeof (globalThis as any).WebSocket === "undefined") {
    const ws: any = await import("websocket");
    (globalThis as any).WebSocket = ws.default?.w3cwebsocket ?? ws.w3cwebsocket;
  }
  const mod: any = await import("@onekeyfe/kaspa-wasm/kaspa.js" as string);
  if (typeof mod.default === "function") {
    await mod.default();
  }
  wasmModule = mod;
  return wasmModule;
}

export interface NativeKaspaAdapterOptions {
  /**
   * Private key (hex, 32 bytes, 64 hex chars). If omitted, adapter will look
   * for KASPA_PRIVATE_KEY environment variable. If also absent, throws — the
   * caller must supply a funded testnet wallet.
   */
  privateKeyHex?: string;
  /**
   * Kaspa network identifier. Defaults to "testnet-10" (the only supported
   * v0.1 target). "mainnet" will be accepted at v0.3.
   */
  networkId?: "testnet-10" | "testnet-11" | "mainnet";
  /**
   * Optional explicit wRPC URL. If omitted, uses the Resolver to auto-discover
   * a public endpoint for the network. Mostly useful in CI when a self-hosted
   * node is available.
   */
  rpcUrl?: string;
  /**
   * Amount in KAS to actually send on each settlement, as a decimal string.
   * The mandate's `amount` field is preserved for the receipt but the actual
   * on-chain KAS transfer uses this fixed amount (see truth-in-labeling
   * above). Default: "100" KAS.
   *
   * Why not smaller: Kaspa's KIP-9 storage-mass penalty rejects transactions
   * whose outputs are radically smaller than their inputs (harmonic mean
   * mismatch). A 100k-KAS faucet-funded wallet cannot cleanly emit a
   * 0.01-KAS output without tripping the ceiling. 100 KAS × ~1000 runs
   * from a 100k faucet fill is more than enough for demo cadence.
   */
  fixedTransferAmountKas?: string;
  /**
   * Optional recipient override. If omitted, the wallet sends to itself
   * (a self-transfer is the cheapest way to prove the network integration).
   */
  recipientAddress?: string;
}

export class NativeKaspaAdapter implements KaspaAdapter {
  private readonly opts: Required<NativeKaspaAdapterOptions>;
  private wasm: KaspaWasmModule | null = null;
  private rpc: unknown = null; // typed via wasm.RpcClient when connected
  private privateKey: unknown = null; // wasm.PrivateKey instance, used for signing
  private keypair: unknown = null;    // wasm.Keypair instance (address / pubkey queries)
  private address: string | null = null;

  constructor(opts: NativeKaspaAdapterOptions = {}) {
    const key = opts.privateKeyHex ?? process.env.KASPA_PRIVATE_KEY;
    if (!key) {
      throw new Error(
        "NativeKaspaAdapter requires a private key. Pass { privateKeyHex } or set env KASPA_PRIVATE_KEY. " +
          "Use `npm run testnet:wallet` to generate one, then fund from https://faucet-tn10.kaspanet.io/",
      );
    }
    this.opts = {
      privateKeyHex: key,
      networkId: opts.networkId ?? "testnet-10",
      rpcUrl: opts.rpcUrl ?? "",
      fixedTransferAmountKas: opts.fixedTransferAmountKas ?? "100",
      recipientAddress: opts.recipientAddress ?? "",
    };
  }

  private async ensureConnected(): Promise<void> {
    if (this.rpc) return;

    const w: any = await loadWasm();
    this.wasm = w;

    // Derive keypair + address from the configured private key.
    const pk = new w.PrivateKey(this.opts.privateKeyHex);
    this.privateKey = pk;
    this.keypair = w.Keypair.fromPrivateKey(pk);
    this.address = pk.toAddress(this.opts.networkId).toString();

    // Connect via explicit URL or Resolver auto-discovery.
    // Encoding is a numeric enum in wasm-bindgen but the serde deserializer
    // wants string form ("borsh"/"json"). The TS typings say camelCase but
    // the underlying serde deserializer wants snake_case field names — pass
    // both to satisfy both readers.
    const rpcConfig: any = {
      encoding: "borsh",
      network_id: this.opts.networkId,
      networkId: this.opts.networkId,
    };
    if (this.opts.rpcUrl) {
      rpcConfig.url = this.opts.rpcUrl;
      this.rpc = new w.RpcClient(rpcConfig);
      await (this.rpc as any).connect();
    } else {
      const resolver = new w.Resolver();
      this.rpc = await resolver.connect(rpcConfig);
    }
  }

  async submitSettlement(tx: SettlementTxData): Promise<string> {
    await this.ensureConnected();
    const w = this.wasm as any;
    const rpc = this.rpc as any;
    const senderAddress = this.address as string;
    const recipient = this.opts.recipientAddress || senderAddress;

    // Encode mandate hashes into the transaction payload. Kaspa transactions
    // support a payload bytes field that is committed at consensus. Format:
    //   "cadenza:v0.1:mandate:{intentHash}:{cartHash}:{paymentHash}"
    //
    // The prefix identifies this as a Cadenza settlement, versioned so future
    // formats can be recognized. The full mandate chain is committed on-chain
    // and off-chain-verifiable against the client-retained mandates.
    const payloadStr = [
      "cadenza:v0.1:mandate",
      tx.mandateHashes.intent,
      tx.mandateHashes.cart,
      tx.mandateHashes.payment,
    ].join(":");
    const payloadBytes = new TextEncoder().encode(payloadStr);

    // Fetch UTXOs available to this sender for spend selection.
    const utxosResp = await rpc.getUtxosByAddresses({ addresses: [senderAddress] });
    const entries = utxosResp.entries as any[];
    if (!entries || entries.length === 0) {
      throw new Error(
        `NativeKaspaAdapter: no UTXOs found for ${senderAddress}. ` +
          `Fund from https://faucet-tn10.kaspanet.io/ and wait ~10s before retrying.`,
      );
    }

    const amountSompi = w.kaspaToSompi(this.opts.fixedTransferAmountKas);
    if (!amountSompi) {
      throw new Error(`Invalid fixedTransferAmountKas: ${this.opts.fixedTransferAmountKas}`);
    }

    // Use the Generator to construct + sign a well-formed transaction with
    // proper fee estimation, change output, and mass calculation. This
    // handles the UTXO-model bookkeeping the raw createTransaction API
    // requires callers to do manually.
    const generator = new w.Generator({
      entries,
      outputs: [{ address: recipient, amount: amountSompi }],
      priorityFee: 0n,
      changeAddress: senderAddress,
      networkId: this.opts.networkId,
      payload: payloadBytes,
    });

    const pending = await generator.next();
    if (!pending) {
      throw new Error("NativeKaspaAdapter: Generator produced no transaction");
    }

    // Sign every input with our PrivateKey (not Keypair — Generator.sign wants PK).
    await pending.sign([this.privateKey]);

    // Submit to the network. Returns the tx ID (hash).
    const txId: string = await pending.submit(rpc);
    return txId;
  }

  async getTransaction(txHash: string): Promise<SettlementTxData | null> {
    await this.ensureConnected();
    const rpc = this.rpc as any;
    try {
      const entry = await rpc.getMempoolEntry({ transactionId: txHash });
      if (!entry) return null;
      // Minimal parse — v0.1 returns the reconstructed shape for the SDK's
      // getTransaction contract. Full payload/mandate parsing is v0.2.
      return {
        chain: this.opts.networkId,
        asset: "KAS",
        amount: this.opts.fixedTransferAmountKas,
        recipient: this.opts.recipientAddress || (this.address as string),
        mandateHashes: { intent: "", cart: "", payment: "" },
      };
    } catch {
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.rpc) {
      try {
        await (this.rpc as any).disconnect();
      } catch {
        // ignore
      }
      this.rpc = null;
    }
  }

  /** Diagnostic: return the derived testnet address for the current wallet. */
  async getAddress(): Promise<string> {
    await this.ensureConnected();
    return this.address as string;
  }

  /** Diagnostic: return current KAS balance in the wallet, as decimal string. */
  async getBalance(): Promise<string> {
    await this.ensureConnected();
    const rpc = this.rpc as any;
    const w = this.wasm as any;
    const senderAddress = this.address as string;
    const resp = await rpc.getBalancesByAddresses({ addresses: [senderAddress] });
    const entry = resp.entries?.[0];
    if (!entry) return "0";
    return w.sompiToKaspaString(entry.balance);
  }
}
