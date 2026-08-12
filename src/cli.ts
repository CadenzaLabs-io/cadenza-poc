/**
 * Demo CLI — walks through the full settlement flow with narration.
 *
 * Run with: npm run demo
 */

import { Cadenza, mandateHash, verifyMandate } from "./index.js";

function divider(label = "") {
  const line = "─".repeat(72);
  if (label) {
    process.stdout.write(`\n${line}\n  ${label}\n${line}\n\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

async function main() {
  process.stdout.write("\n");
  process.stdout.write("  CADENZA — AP2 settlement on Kaspa (PoC)\n");
  process.stdout.write("  ────────────────────────────────────────\n");

  const c = new Cadenza({ adapter: "mock", chain: "kasplex-l2" });

  divider("1. Generate principals");
  const user = c.createPrincipal();
  const agent = c.createPrincipal();
  const merchant = c.createPrincipal();
  console.log(`  user:     ${user.did}`);
  console.log(`  agent:    ${agent.did}`);
  console.log(`  merchant: ${merchant.did}`);

  divider("2. Execute the settle() flow");
  console.log("  Authorized purchase: 1× GPU compute hour @ $12.50");
  console.log("  Spend cap on the Intent mandate: $100\n");

  const t0 = Date.now();
  const settlement = await c.settle({
    user,
    agent,
    merchant,
    intent: { spendCap: "100", merchants: [merchant.did] },
    cart: { items: [{ id: "gpu-hour-h100", price: "12.50" }] },
    payment: { asset: "USDT-KRC20", amount: "12.50" },
  });
  const elapsed = Date.now() - t0;
  console.log(`  ✓ Settled in ${elapsed}ms`);

  divider("3. Receipt — settlement transaction");
  console.log(`  chain:     ${settlement.chain}`);
  console.log(`  asset:     ${settlement.asset}`);
  console.log(`  amount:    ${settlement.amount}`);
  console.log(`  recipient: ${settlement.recipient}`);
  console.log(`  txHash:    ${settlement.txHash}`);

  divider("4. Mandate hash chain (committed on-chain)");
  console.log(`  intent:   ${settlement.mandateHashes.intent}`);
  console.log(`  cart:     ${settlement.mandateHashes.cart}`);
  console.log(`  payment:  ${settlement.mandateHashes.payment}`);

  divider("5. Verify the off-chain mandates against the on-chain hashes");
  const ok = {
    intent:
      mandateHash(settlement.mandates.intent) === settlement.mandateHashes.intent,
    cart: mandateHash(settlement.mandates.cart) === settlement.mandateHashes.cart,
    payment:
      mandateHash(settlement.mandates.payment) === settlement.mandateHashes.payment,
    intentSig: verifyMandate(settlement.mandates.intent, user.publicKey),
    cartSig: verifyMandate(settlement.mandates.cart, agent.publicKey),
    paymentSig: verifyMandate(settlement.mandates.payment, merchant.publicKey),
  };
  for (const [check, pass] of Object.entries(ok)) {
    console.log(`  ${pass ? "✓" : "✗"} ${check}`);
  }

  const allPass = Object.values(ok).every(Boolean);
  divider();
  if (allPass) {
    console.log("\n  Settlement is verifiable end-to-end. All checks passed.\n");
  } else {
    console.log("\n  Settlement verification FAILED. Investigate above.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
