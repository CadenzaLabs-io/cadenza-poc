# Cadenza™ SDK

[![test](https://github.com/CadenzaLabs-io/cadenza-poc/actions/workflows/test.yml/badge.svg)](https://github.com/CadenzaLabs-io/cadenza-poc/actions/workflows/test.yml)
[![licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](./LICENSE)
[![node: 20+](https://img.shields.io/badge/node-20%2B-brightgreen.svg)](https://nodejs.org/)
[![patent: pending](https://img.shields.io/badge/patent-pending-orange.svg)](./PATENTS.md)

**Covenant kernel beneath any agent-payment protocol, any settlement stablecoin, any covenant-capable chain. MIT-licensed. See [PATENTS.md](./PATENTS.md).**

Cadenza is a covenant-kernel settlement rail for AI-agent-initiated payments. It is designed to sit beneath — not compete with — the emerging landscape of agent-payment protocols. This SDK is the MIT-licensed reference implementation.

Three axes of agnosticism:

- **Protocol-agnostic.** The adapter surface accepts any AI-agent payment protocol — AP2, x402, MPP, MCP, A2A, AEP2, and successors — without changing the underlying covenant runtime.
- **Stablecoin-agnostic.** The settlement adapter is issuer-neutral at the chain-facing boundary. OUSD-KRC20 is the primary asset; USDT-KRC20 is supported as a parallel-track option; any covenant-issuable stablecoin plugs in.
- **Chain-agnostic.** The native adapter targets Kaspa L1 (post-Toccata, covenant-capable). The `KaspaAdapter` interface is chain-portable to any covenant-capable substrate; the EVM sibling family covers analogous inventions for EVM-compatible substrates.

**Status:** v0.1 — 23 passing tests; live testnet-10 settlement working; not production-audited.

> **Live browser demo:** [`cadenzalabs.dev/demo`](https://cadenzalabs.dev/demo) — click a mandate settlement and see a fresh real testnet-10 transaction post in ~500 ms. Every click produces a novel on-chain proof, viewable at [`tn10.kaspa.stream`](https://tn10.kaspa.stream).

## What ships today vs. what the surface accepts

The positioning surface (above) is intentionally open-ended. The **shipped-adapter list** below tracks only what is actually implemented and tested in this repository.

| Protocol adapter | Origin | Status in this repo | Roadmap |
|---|---|---|---|
| **AP2** | Google (donated to FIDO Alliance, April 2026) | ✅ implemented in `src/mandates.ts`, `src/settlement.ts` — 23 tests, live testnet-10 settlement | mainnet cutover Q4 2026 |
| **x402** | Coinbase (open-sourced to Linux Foundation, April 2026) | 🔵 specification published at [cadenzalabs.dev/docs](https://cadenzalabs.dev/docs); reference implementation planned v0.4 | Q3 2026 |
| **MPP** | Stripe + Tempo, with Visa contributions (IETF standards track `draft-httpauth-payment`) | 🔵 specification published at [cadenzalabs.dev/docs](https://cadenzalabs.dev/docs); reference implementation planned v0.5 | Q3 2026 |

Additional protocol adapters (MCP, A2A, AEP2, and future protocols) will be added as adoption warrants; the adapter interface is designed to accommodate them without changing the underlying settlement path.

All protocol adapters shipped in this repository are under the same MIT licence. The production adapters (hardened wRPC pools, KRC-20 settlement, session persistence, per-vertical trigger configuration) live in a separate repository under Business Source Licence 1.1. The hosted settlement services are Cadenza Labs proprietary.

## The "seven lines of code" promise — proven

```typescript
import { Cadenza } from "@cadenza/sdk";

const c = new Cadenza({ adapter: "mock" });
const [user, agent, merchant] = [c.createPrincipal(), c.createPrincipal(), c.createPrincipal()];
const s = await c.settle({
  user, agent, merchant,
  intent: { spendCap: "100" },
  cart: { items: [{ id: "demo", price: "12.50" }] },
  payment: { asset: "OUSD-KRC20", amount: "12.50" },
});
console.log(s.txHash, s.mandateHashes);
```

That's the entire integration. The SDK handles W3C VC construction, Ed25519 signing of each mandate, mandate chain hashing, settlement transaction construction, and the on-chain commit.

Swap `adapter: "mock"` for `new NativeKaspaAdapter({ networkId: "testnet-10" })` and the same seven lines settle on real Kaspa L1.

## What this PoC demonstrates

| Claim | Demonstrated by |
|---|---|
| AP2 mandate construction (Intent / Cart / Payment) works | `src/mandates.ts` + 5 tests in `tests/mandates.test.ts` |
| Mandates form an unforgeable cryptographic chain | `tests/settlement.test.ts` — cart→intent and payment→cart hash references |
| Tampering with a mandate breaks both signature and hash | `examples/with-tampering.ts` — `npm run demo:tampered` |
| Settlement embeds all three mandate hashes on-chain | `src/settlement.ts` + on-chain hashes recoverable from result |
| Deterministic JSON canonicalization (signed bytes are reproducible) | `src/canonical.ts` + 5 tests in `tests/canonical.test.ts` |
| Per-settlement uniqueness via nonces | `tests/mandates.test.ts` — identical params produce different hashes |
| Full settle-and-verify flow runs end-to-end | `src/cli.ts` — `npm run demo` |
| Real Kaspa L1 settlement on testnet-10 | `src/adapter/native-kaspa.ts` — `npm run testnet:smoke` |
| Streaming micropayment sessions (Cadenza Stream) | `src/streaming.ts` + 9 tests in `tests/streaming.test.ts` |

## Running it

```bash
npm install
npm test               # 23 tests, ~2s
npm run demo           # narrated end-to-end CLI walkthrough
npm run demo:seven     # the literal 7-line example
npm run demo:tampered  # tampering detection proof
npm run demo:streaming # Cadenza Stream — LLM token billing simulation
npm run typecheck      # strict TS, no errors
```

Requirements: Node 20+.

### Live Kaspa L1 testnet (optional)

```bash
npm run testnet:wallet   # generate keypair; fund at https://faucet-tn10.kaspanet.io/
export KASPA_PRIVATE_KEY="<hex from wallet output>"
npm run testnet:smoke    # posts a real testnet-10 tx, ~500 ms end-to-end
```

The smoke test prints an explorer link at [`tn10.kaspa.stream`](https://tn10.kaspa.stream) where you can verify the settlement transaction and inspect the embedded mandate hashes.

## Architecture

```
src/
  types.ts          — Principal, Mandate types, W3C VC envelope, SettlementResult
  canonical.ts      — Deterministic JSON serialization (RFC 8785 subset)
  crypto.ts         — Ed25519 sign/verify, SHA-256, keypair generation
  mandates.ts       — Intent/Cart/Payment construction, signing, verification, hashing
  settlement.ts     — Mandate-chain validation, settlement tx assembly, adapter dispatch
  streaming.ts      — Cadenza Stream: micropayment session state machine
  index.ts          — Cadenza class — the "seven lines" public API
  cli.ts            — Narrated CLI demo

  adapter/
    types.ts        — KaspaAdapter interface (stablecoin-agnostic, chain-facing boundary)
    mock.ts         — In-memory adapter (simulates ~1s finality at 50ms) — used in tests + demos
    native-kaspa.ts — Real Kaspa L1 adapter (testnet-10 today, mainnet queued) via @onekeyfe/kaspa-wasm
    ousd.ts         — STUB for OUSD-KRC20 on Kaspa L1 (primary; awaiting mainnet issuance)
    kasplex.ts      — STUB retained for reference (Kasplex L2, deprecated per L1-only pivot)

examples/
  seven-lines.ts             — The 7-line marketing claim, executable
  with-tampering.ts          — Verification rejects tampered mandates
  streaming-llm.ts           — Cadenza Stream: LLM token billing walkthrough
  generate-testnet-wallet.ts — Keypair generation for testnet-10
  testnet-smoke.ts           — End-to-end real testnet-10 settlement smoke test

tests/
  canonical.test.ts   — 5 tests
  mandates.test.ts    — 5 tests
  settlement.test.ts  — 4 tests
  streaming.test.ts   — 9 tests
```

## What's real vs. what's mocked

**Real (production-grade cryptography, mock chain layer for `mock` adapter):**
- Ed25519 keypair generation (Node `crypto.generateKeyPairSync('ed25519')`)
- W3C VC structure with `Ed25519Signature2020` proof
- Canonical JSON for stable hashing (RFC 8785 subset)
- SHA-256 mandate hashes
- Mandate chain enforcement (Cart references Intent, Payment references Cart)
- End-to-end signature verification
- Kaspa L1 testnet-10 settlement via `NativeKaspaAdapter` — real KAS transfers with mandate-hash-committed transaction payload, ~500 ms end-to-end, explorer-verifiable

**Mocked (for the `mock` adapter):**
- The settlement transaction is constructed correctly but submitted to an in-memory store, not a live chain endpoint. The `MockKaspaAdapter` returns the SHA-256 of the canonical settlement payload as the "tx hash."
- Compressed finality (50 ms instead of Kaspa's ~1 s) for fast tests
- DID encoding is simplified (hex slice instead of full multibase/multicodec)

The `native-kaspa` adapter does everything above for real on testnet-10.

## What's next (v0.2+)

1. **KRC-20 settlement:** replace native KAS transfers with OUSD-KRC20 (primary) and USDT-KRC20 (parallel) transfers on Kaspa L1. Adapter interface is already stablecoin-agnostic — only asset identifier, RPC endpoint, and issuer-specific compliance hooks differ. Gated on KRC-20 SDK maturity and mainnet OUSD or USDT issuance.
2. **Mainnet native KAS adapter:** small polish over `native-kaspa.ts` — swap `networkId: "testnet-10"` for `"mainnet"` and validate against production wRPC endpoints.
3. **Full Ed25519Signature2020 multibase encoding** for strict W3C VC conformance.
4. **Covenant-enforced spending guards:** SilverScript covenant integration (Phase 2, post-Toccata fork) — daily caps, merchant whitelists, co-signature thresholds enforced at the chain layer.
5. **`@cadenza/sdk` on npm** once the entity is formed and package name is claimed.
6. **wRPC reconnect resilience** in `NativeKaspaAdapter` — handle transient Kaspa public-endpoint drops with a single automatic retry.

## Notes for reviewers

- **Not audited.** This PoC is a feasibility demonstration. Production code will require formal cryptographic review, side-channel hardening, and protocol-spec conformance testing.
- **HNP, ZK Verifiable Intent, and covenant guards are Phase 2.** The v0.1 scope is the AP2 mandate flow plus real Kaspa L1 settlement. Those additional protocol surfaces are described in the [architecture documentation](https://cadenzalabs.dev/docs) and are not implemented here yet.
- **CI runs on Node 20 and 22.** See [`.github/workflows/test.yml`](.github/workflows/test.yml).

## Licence

MIT — see [LICENSE](./LICENSE). This licence covers the source code in this repository. It does **not** grant any rights in the "Cadenza" or "Motif" trademarks, service marks, or logos of Cadenza Labs, nor any implied licence under the patents referenced below.

## Notices

**Patent Pending.** Portions of the design implemented in this software development kit are the subject of an extensive United States provisional patent portfolio filed with the USPTO by Cadenza Agentic Solutions Inc., a Delaware corporation doing business as "Cadenza Labs" (interim licensor pending assignment: Gitche Gumee Investment Corporation, a Nevada corporation). See [`PATENTS.md`](./PATENTS.md) for Cadenza Labs' §287(a) virtual-marking landing page, defensive-posture commitments (including the standing statement that consumers of the SDK's public interfaces do not require a separate patent licence), and the relationship between the MIT licence and the pending patents.

**Trademarks.** **CADENZA™** and **MOTIF™** are trademarks of Cadenza Labs (interim: GGIC). Application(s) filed with the United States Patent and Trademark Office. The MIT licence does not grant any right to use these names, marks, or logos in a manner that would suggest endorsement of, or affiliation with, any modified or derivative work.

**Copyright.** © 2026 Cadenza Labs. Copyright registration filed with the United States Copyright Office concurrent with the public release of this repository.

**Contact.** For patent-licensing enquiries, trademark-use permissions, or commercial-licensing conversations that extend beyond the MIT grant, contact `licensing@cadenzalabs.dev`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md). All contributors must sign a Contributor Licence Agreement (individual or corporate) before merge.

---

*Cadenza is developed by Cadenza Labs with Kaspa Ecosystem Foundation coordination.*
