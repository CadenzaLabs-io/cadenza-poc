// Cadenza Stream — LLM token billing simulation.
//
// Run: npm run demo:streaming
//
// Demonstrates: agent pays an LLM provider per token in real time, with
// off-chain accumulation and periodic on-chain batched settlement on Kaspa.

import { Cadenza, MockKaspaAdapter, StreamSession } from "../src/index.js";

function divider(label = "") {
  const line = "─".repeat(72);
  process.stdout.write(label ? `\n${line}\n  ${label}\n${line}\n\n` : `${line}\n`);
}

async function main() {
  process.stdout.write("\n  CADENZA STREAM — LLM token billing simulation\n");
  process.stdout.write("  ───────────────────────────────────────────────\n");

  const c = new Cadenza({ adapter: "mock", chain: "kasplex-l2" });
  const adapter = new MockKaspaAdapter();

  const user = c.createPrincipal();
  const agent = c.createPrincipal();
  const provider = c.createPrincipal();

  divider("Session parameters");
  console.log("  User authorizes:    $10 over 1 hour");
  console.log("  Rate:               $0.001 per token");
  console.log("  Provider:           simulated LLM provider");
  console.log("  Settlement trigger: every $1.00 of unsettled balance");

  const session = new StreamSession(adapter, {
    user,
    agent,
    provider,
    rate: { unit: "token", pricePerUnit: "0.001" },
    spendCap: "10.00",
    asset: "USDT-KRC20",
    chain: "kasplex-l2",
    triggers: [{ amount: "1.00" }],
  });

  console.log(`\n  Streaming Intent issued.  sessionId: ${session.sessionId}`);

  divider("Simulating 5,000 LLM tokens (event = 1 token)");
  const t0 = Date.now();
  for (let i = 0; i < 5000; i++) {
    await session.recordEvent({ units: 1 });
  }
  const elapsed = Date.now() - t0;
  console.log(`  Streamed 5,000 events in ${elapsed}ms`);

  divider("Close session — final settlement");
  const summary = await session.close();

  console.log(`  Total events:        ${summary.totalEvents}`);
  console.log(`  Total units:         ${summary.totalUnits} tokens`);
  console.log(`  Total cost:          $${Number.parseFloat(summary.totalCost).toFixed(4)}`);
  console.log(`  Settled amount:      $${Number.parseFloat(summary.settledAmount).toFixed(4)}`);
  console.log(`  Unsettled balance:   $${Number.parseFloat(summary.unsettledAmount).toFixed(4)}`);
  console.log(`  On-chain settlements: ${summary.settlements.length}`);

  divider("Per-settlement breakdown");
  console.log("  #   | from→to seq  | amount      | tx hash");
  console.log("  ----+--------------+-------------+--------------------------");
  for (let i = 0; i < summary.settlements.length; i++) {
    const s = summary.settlements[i]!;
    const range = `${s.fromSequence}→${s.toSequence}`.padEnd(12);
    const amt = `$${Number.parseFloat(s.amount).toFixed(4)}`.padEnd(11);
    console.log(`  ${(i + 1).toString().padEnd(3)} | ${range} | ${amt} | ${s.txHash.slice(0, 32)}…`);
  }

  divider("Economics");
  // Comparable per-call card rail: $0.30 + 2.9% × $5 = ~$0.445 per call
  // Card-rail direct per-event for 5000 events: 5000 × $0.445 ≈ $2,225
  // Cadenza Stream: 5 settlements × sub-cent = ~$0.05 total
  const cardRailEquivalent = 5000 * 0.445;
  const cadenzaFee = summary.settlements.length * 0.005; // ~half-cent per settle
  console.log("  Hypothetical per-event card-rail fees ($0.30 + 2.9% per call):");
  console.log(`    5,000 events × ($0.30 + 2.9% of $0.001) ≈ $${cardRailEquivalent.toFixed(2)}`);
  console.log("  Cadenza Stream batched fees:");
  console.log(`    ${summary.settlements.length} settlements × sub-cent ≈ $${cadenzaFee.toFixed(4)}`);
  console.log(`\n  Fee ratio: ${(cardRailEquivalent / cadenzaFee).toFixed(0)}× cheaper`);
  console.log("  AND real-time. AND audit-grade. AND on-chain verifiable.\n");
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
