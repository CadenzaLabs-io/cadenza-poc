// End-to-end smoke test: full Cadenza mandate flow settling a REAL Kaspa
// testnet-10 transaction via NativeKaspaAdapter.
//
// Prereqs:
//   1. `npm install`
//   2. `npx tsx examples/generate-testnet-wallet.ts` — generates + prints a wallet
//   3. Set env: `export KASPA_PRIVATE_KEY="..."`
//   4. Fund the wallet from https://faucet-tn10.kaspanet.io/
//
// Run: `npm run testnet:smoke`

import { Cadenza } from "../src/index.js";
import { NativeKaspaAdapter } from "../src/adapter/native-kaspa.js";

function divider(label = "") {
  const line = "─".repeat(72);
  process.stdout.write(label ? `\n${line}\n  ${label}\n${line}\n\n` : `${line}\n`);
}

async function main() {
  divider("Cadenza × Kaspa testnet-10 — real network settlement smoke test");

  if (!process.env.KASPA_PRIVATE_KEY) {
    console.error(
      "  ✗ KASPA_PRIVATE_KEY not set. Run examples/generate-testnet-wallet.ts first,\n" +
        "    save the printed private key, and fund the address from the faucet.\n",
    );
    process.exit(1);
  }

  const adapter = new NativeKaspaAdapter({
    networkId: "testnet-10",
    fixedTransferAmountKas: "100",
  });

  divider("Wallet");
  const address = await adapter.getAddress();
  console.log(`  Address:  ${address}`);
  const balance = await adapter.getBalance();
  console.log(`  Balance:  ${balance} KAS`);

  if (Number.parseFloat(balance.replace(/,/g, "")) < 500) {
    console.error(
      `\n  ✗ Insufficient balance for a smoke test (~500 KAS minimum for a 100-KAS demo tx + KIP-9 headroom).\n` +
        `    Fund ${address} from https://faucet-tn10.kaspanet.io/ and retry.\n`,
    );
    await adapter.disconnect();
    process.exit(1);
  }

  divider("Building AP2 mandate chain");
  const c = new Cadenza({ adapter, chain: "kaspa-l1-testnet-10" });
  const user = c.createPrincipal();
  const agent = c.createPrincipal();
  const merchant = c.createPrincipal();
  console.log(`  User:      ${user.did.slice(0, 32)}…`);
  console.log(`  Agent:     ${agent.did.slice(0, 32)}…`);
  console.log(`  Merchant:  ${merchant.did.slice(0, 32)}…`);

  divider("Settling on Kaspa L1 testnet-10");
  const t0 = Date.now();
  const result = await c.settle({
    user,
    agent,
    merchant,
    intent: { spendCap: "5.00" },
    cart: { items: [{ id: "coffee", price: "4.28" }] },
    payment: { asset: "USDT-KRC20", amount: "4.28" },
  });
  const elapsed = Date.now() - t0;

  console.log(`  ✓ Settled in ${elapsed}ms\n`);
  console.log(`  Chain:       ${result.chain}`);
  console.log(`  Tx hash:     ${result.txHash}`);
  console.log(
    `  Explorer:    https://tn10.kaspa.stream/transactions/${result.txHash}`,
  );
  console.log(`  Intent:      ${result.mandateHashes.intent}`);
  console.log(`  Cart:        ${result.mandateHashes.cart}`);
  console.log(`  Payment:     ${result.mandateHashes.payment}`);

  divider("Reconciliation");
  const balanceAfter = await adapter.getBalance();
  console.log(`  Balance after: ${balanceAfter} KAS`);
  console.log(`  Delta:         ${(Number.parseFloat(balance) - Number.parseFloat(balanceAfter)).toFixed(8)} KAS`);
  console.log("\n  (Delta = 100 KAS self-transfer + Kaspa network fee. Amount sized above KIP-9 storage-mass floor.)\n");

  await adapter.disconnect();
}

main().catch((err) => {
  console.error("\n  ✗ Smoke test failed:", err.message || err);
  console.error(err.stack || "");
  process.exit(1);
});
