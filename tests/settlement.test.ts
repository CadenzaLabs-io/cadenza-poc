import { test } from "node:test";
import assert from "node:assert";
import { Cadenza, mandateHash } from "../src/index.js";

test("settle() produces a transaction with all three mandate hashes embedded", async () => {
  const c = new Cadenza({ adapter: "mock", chain: "kasplex-l2" });
  const user = c.createPrincipal();
  const agent = c.createPrincipal();
  const merchant = c.createPrincipal();

  const s = await c.settle({
    user,
    agent,
    merchant,
    intent: { spendCap: "100" },
    cart: { items: [{ id: "gpu-hour", price: "12.50" }] },
    payment: { asset: "USDT-KRC20", amount: "12.50" },
  });

  assert.ok(s.txHash.startsWith("0x"), "txHash has 0x prefix");
  assert.equal(s.chain, "kasplex-l2");
  assert.equal(s.asset, "USDT-KRC20");
  assert.equal(s.amount, "12.50");
});

test("mandate chain references resolve: cart→intent, payment→cart", async () => {
  const c = new Cadenza({ adapter: "mock" });
  const user = c.createPrincipal();
  const agent = c.createPrincipal();
  const merchant = c.createPrincipal();

  const s = await c.settle({
    user,
    agent,
    merchant,
    intent: { spendCap: "100" },
    cart: { items: [{ id: "x", price: "5.00" }] },
    payment: { asset: "USDT-KRC20", amount: "5.00" },
  });

  assert.equal(
    s.mandates.cart.credentialSubject.intentHash,
    mandateHash(s.mandates.intent),
  );
  assert.equal(
    s.mandates.payment.credentialSubject.cartHash,
    mandateHash(s.mandates.cart),
  );
  assert.equal(
    s.mandateHashes.intent,
    mandateHash(s.mandates.intent),
  );
});

test("on-chain mandate hashes match recomputed off-chain mandate hashes", async () => {
  const c = new Cadenza({ adapter: "mock" });
  const user = c.createPrincipal();
  const agent = c.createPrincipal();
  const merchant = c.createPrincipal();

  const s = await c.settle({
    user, agent, merchant,
    intent: { spendCap: "100" },
    cart: { items: [{ id: "x", price: "5.00" }] },
    payment: { asset: "USDT-KRC20", amount: "5.00" },
  });

  assert.equal(s.mandateHashes.intent, mandateHash(s.mandates.intent));
  assert.equal(s.mandateHashes.cart, mandateHash(s.mandates.cart));
  assert.equal(s.mandateHashes.payment, mandateHash(s.mandates.payment));
});

test("identical settle() calls produce different tx hashes (nonce-driven)", async () => {
  const c = new Cadenza({ adapter: "mock" });
  const user = c.createPrincipal();
  const agent = c.createPrincipal();
  const merchant = c.createPrincipal();
  const params = {
    user, agent, merchant,
    intent: { spendCap: "100" },
    cart: { items: [{ id: "x", price: "1.00" }] },
    payment: { asset: "USDT-KRC20", amount: "1.00" },
  };
  const a = await c.settle(params);
  const b = await c.settle(params);
  assert.notEqual(a.txHash, b.txHash);
});
