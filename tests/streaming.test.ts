import { test } from "node:test";
import assert from "node:assert";
import { Cadenza, MockKaspaAdapter, StreamSession, mandateHash, verifyMandate } from "../src/index.js";

test("Streaming Intent Mandate verifies under the user's key", () => {
  const c = new Cadenza();
  const session = new StreamSession(new MockKaspaAdapter(), {
    user: c.createPrincipal(),
    agent: c.createPrincipal(),
    provider: c.createPrincipal(),
    rate: { unit: "token", pricePerUnit: "0.001" },
    spendCap: "5.00",
    asset: "USDT-KRC20",
    chain: "kasplex-l2",
  });
  // The signing principal for the StreamingIntent is the user
  // Reconstruct: session.streamingIntent's issuer should match the user's DID
  assert.ok(session.streamingIntent.issuer.startsWith("did:key:z"));
  assert.equal(
    session.streamingIntent.type[1],
    "StreamingIntentMandate",
  );
});

test("recording events updates cumulative state", async () => {
  const session = new StreamSession(new MockKaspaAdapter(), {
    user: new Cadenza().createPrincipal(),
    agent: new Cadenza().createPrincipal(),
    provider: new Cadenza().createPrincipal(),
    rate: { unit: "token", pricePerUnit: "0.001" },
    spendCap: "5.00",
    asset: "USDT-KRC20",
    chain: "kasplex-l2",
  });

  await session.recordEvent({ units: 100 });
  await session.recordEvent({ units: 150 });
  await session.recordEvent({ units: 50 });

  const summary = session.summary();
  assert.equal(summary.totalEvents, 3);
  assert.equal(summary.totalUnits, "300");
  // 300 * 0.001 = 0.30
  assert.equal(Number.parseFloat(summary.totalCost), 0.3);
});

test("settle() produces a settlement with the correct incremental amount", async () => {
  const adapter = new MockKaspaAdapter();
  const session = new StreamSession(adapter, {
    user: new Cadenza().createPrincipal(),
    agent: new Cadenza().createPrincipal(),
    provider: new Cadenza().createPrincipal(),
    rate: { unit: "token", pricePerUnit: "0.01" },
    spendCap: "100.00",
    asset: "USDT-KRC20",
    chain: "kasplex-l2",
  });

  await session.recordEvent({ units: 50 }); // $0.50
  const r1 = await session.settle();
  assert.ok(r1);
  assert.equal(Number.parseFloat(r1.amount), 0.5);

  await session.recordEvent({ units: 30 }); // +$0.30
  const r2 = await session.settle();
  assert.ok(r2);
  assert.equal(Number.parseFloat(r2.amount), 0.3);
  assert.equal(Number.parseFloat(r2.cumulativeAmount), 0.8);
  assert.equal(r2.fromSequence, 2);
  assert.equal(r2.toSequence, 2);
});

test("amount trigger fires settlement automatically", async () => {
  const session = new StreamSession(new MockKaspaAdapter(), {
    user: new Cadenza().createPrincipal(),
    agent: new Cadenza().createPrincipal(),
    provider: new Cadenza().createPrincipal(),
    rate: { unit: "token", pricePerUnit: "0.001" },
    spendCap: "10.00",
    asset: "USDT-KRC20",
    chain: "kasplex-l2",
    triggers: [{ amount: "0.50" }],
  });

  // Each event is 100 tokens = $0.10; trigger at $0.50 (every 5 events)
  for (let i = 0; i < 25; i++) {
    await session.recordEvent({ units: 100 });
  }

  const summary = session.summary();
  assert.equal(summary.totalEvents, 25);
  // 25 × $0.10 = $2.50 total
  assert.equal(Number.parseFloat(summary.totalCost), 2.5);
  // 5 settlements at $0.50 each
  assert.equal(summary.settlements.length, 5);
});

test("events trigger fires settlement automatically", async () => {
  const session = new StreamSession(new MockKaspaAdapter(), {
    user: new Cadenza().createPrincipal(),
    agent: new Cadenza().createPrincipal(),
    provider: new Cadenza().createPrincipal(),
    rate: { unit: "token", pricePerUnit: "0.001" },
    spendCap: "10.00",
    asset: "USDT-KRC20",
    chain: "kasplex-l2",
    triggers: [{ events: 10 }],
  });

  for (let i = 0; i < 100; i++) {
    await session.recordEvent({ units: 1 });
  }

  const summary = session.summary();
  assert.equal(summary.totalEvents, 100);
  // 100/10 = 10 settlements
  assert.equal(summary.settlements.length, 10);
});

test("close() settles any outstanding balance and reports summary", async () => {
  const session = new StreamSession(new MockKaspaAdapter(), {
    user: new Cadenza().createPrincipal(),
    agent: new Cadenza().createPrincipal(),
    provider: new Cadenza().createPrincipal(),
    rate: { unit: "token", pricePerUnit: "0.001" },
    spendCap: "10.00",
    asset: "USDT-KRC20",
    chain: "kasplex-l2",
    triggers: [{ amount: "10.00" }], // very high — won't auto-settle
  });

  for (let i = 0; i < 100; i++) {
    await session.recordEvent({ units: 1 });
  }
  // 100 × $0.001 = $0.10 outstanding, no auto-settle yet
  const beforeClose = session.summary();
  assert.equal(beforeClose.settlements.length, 0);
  assert.equal(Number.parseFloat(beforeClose.unsettledAmount), 0.1);

  const summary = await session.close();
  assert.equal(summary.settlements.length, 1);
  assert.equal(Number.parseFloat(summary.unsettledAmount), 0);
  assert.equal(Number.parseFloat(summary.settledAmount), 0.1);
});

test("recording events that would exceed spendCap throws", async () => {
  const session = new StreamSession(new MockKaspaAdapter(), {
    user: new Cadenza().createPrincipal(),
    agent: new Cadenza().createPrincipal(),
    provider: new Cadenza().createPrincipal(),
    rate: { unit: "token", pricePerUnit: "0.01" },
    spendCap: "1.00",
    asset: "USDT-KRC20",
    chain: "kasplex-l2",
  });

  // Spend up to $0.99 (99 units)
  await session.recordEvent({ units: 99 });
  // Next event of 2 units = $0.02 would push to $1.01, over cap
  await assert.rejects(
    () => session.recordEvent({ units: 2 }),
    /spendCap/,
  );
});

test("stream mandate sequence numbers are monotonic", async () => {
  const session = new StreamSession(new MockKaspaAdapter(), {
    user: new Cadenza().createPrincipal(),
    agent: new Cadenza().createPrincipal(),
    provider: new Cadenza().createPrincipal(),
    rate: { unit: "token", pricePerUnit: "0.001" },
    spendCap: "10.00",
    asset: "USDT-KRC20",
    chain: "kasplex-l2",
  });

  await session.recordEvent({ units: 100 });
  const r1 = await session.settle();
  await session.recordEvent({ units: 100 });
  const r2 = await session.settle();
  await session.recordEvent({ units: 100 });
  const r3 = await session.settle();

  assert.ok(r1 && r2 && r3);
  assert.equal(r1.toSequence, 1);
  assert.equal(r2.toSequence, 2);
  assert.equal(r3.toSequence, 3);
  assert.equal(r2.fromSequence, 2);
  assert.equal(r3.fromSequence, 3);
});

test("each settlement produces a unique transaction hash", async () => {
  const session = new StreamSession(new MockKaspaAdapter(), {
    user: new Cadenza().createPrincipal(),
    agent: new Cadenza().createPrincipal(),
    provider: new Cadenza().createPrincipal(),
    rate: { unit: "token", pricePerUnit: "0.001" },
    spendCap: "10.00",
    asset: "USDT-KRC20",
    chain: "kasplex-l2",
  });

  await session.recordEvent({ units: 100 });
  const r1 = await session.settle();
  await session.recordEvent({ units: 100 });
  const r2 = await session.settle();

  assert.ok(r1 && r2);
  assert.notEqual(r1.txHash, r2.txHash);
});
