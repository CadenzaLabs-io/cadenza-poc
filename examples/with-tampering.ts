// Demonstrate that mandate verification rejects tampered mandates.
// Run: npm run demo:tampered

import { Cadenza, mandateHash, verifyMandate } from "../src/index.js";

const c = new Cadenza({ adapter: "mock" });
const user = c.createPrincipal();
const agent = c.createPrincipal();
const merchant = c.createPrincipal();

const settlement = await c.settle({
  user, agent, merchant,
  intent: { spendCap: "100" },
  cart: { items: [{ id: "gpu-hour", price: "12.50" }] },
  payment: { asset: "USDT-KRC20", amount: "12.50" },
});

console.log("\n  Original settlement verifies?");
const origIntentOk = verifyMandate(settlement.mandates.intent, user.publicKey);
const origHashOk =
  mandateHash(settlement.mandates.intent) === settlement.mandateHashes.intent;
console.log(`  ${origIntentOk ? "✓" : "✗"} signature valid`);
console.log(`  ${origHashOk ? "✓" : "✗"} hash matches on-chain commitment`);

console.log("\n  Now tamper with the Intent mandate: raise spendCap to $1,000,000");
const tampered = JSON.parse(JSON.stringify(settlement.mandates.intent));
tampered.credentialSubject.scope.spendCap = "1000000";

const tampHashOk =
  mandateHash(tampered) === settlement.mandateHashes.intent;
const tampSigOk = verifyMandate(tampered, user.publicKey);

console.log(`  ${tampHashOk ? "✗" : "✓"} hash matches on-chain commitment: ${tampHashOk}`);
console.log(`  ${tampSigOk ? "✗" : "✓"} signature still valid:              ${tampSigOk}`);

if (!tampHashOk && !tampSigOk) {
  console.log("\n  ✓ Tampering detected. Both hash and signature checks fail as expected.\n");
} else {
  console.log("\n  ✗ Tampering NOT detected — this is a critical PoC failure.\n");
  process.exit(1);
}
