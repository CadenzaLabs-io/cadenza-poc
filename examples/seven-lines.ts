// The literal "seven lines of code" Cadenza promise.
// Run: npm run demo:seven

import { Cadenza } from "../src/index.js";

const c = new Cadenza({ adapter: "mock" });
const [user, agent, merchant] = [c.createPrincipal(), c.createPrincipal(), c.createPrincipal()];
const s = await c.settle({
  user, agent, merchant,
  intent: { spendCap: "100" },
  cart: { items: [{ id: "demo", price: "12.50" }] },
  payment: { asset: "OUSD-KRC20", amount: "12.50" },
});
console.log(`Settled: ${s.amount} ${s.asset} → ${s.recipient}`);
console.log(`Tx:      ${s.txHash}`);
console.log(`Hashes:  intent=${s.mandateHashes.intent.slice(0, 16)}…  cart=${s.mandateHashes.cart.slice(0, 16)}…  payment=${s.mandateHashes.payment.slice(0, 16)}…`);
