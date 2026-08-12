# `mpp/` — MPP Payment-Token Construction (Reference Implementation)

Scaffold for Cadenza's reference implementation of the **MPP (Merchant Payment Protocol) payment-token construction** on Kaspa L1. Currently type interfaces only; runtime implementation ships as `v0.5` in Q3 2026.

## What lives here (planned)

The MPP payment-token construction surface described in the [MPP payment-token specification](https://cadenzalabs.dev/docs):

- Deterministic token construction from an issuer intent
- Signature verification against issuer authority
- Payment-token settlement flow through the KRC-20 covenant suite
- Reconciliation helpers for issuer-to-issuer settlement queries

Backed by the existing Cadenza SDK primitives (canonical JSON, Ed25519 signing, chain-hash validation) and the native Kaspa L1 adapter shipped in v0.1.

**MIT-licensed, reference implementation tier.** The production MPP flow — with hardened compliance hooks, batched settlement optimisation, and an interop test harness — lives in a separate Cadenza Labs repository under Business Source Licence 1.1, targeted alongside AP2 mainnet cutover in Q4 2026. See the top-level [`README.md`](../../README.md) for the full open-core architecture.

## Contract

- **Interface:** deterministic token construction, verification, settlement dispatch, and reconciliation lookup; TypeScript-level types in [`./types.ts`](./types.ts).
- **Dependencies:** consumes the SDK's canonical JSON serialisation, Ed25519 signing, and the native Kaspa L1 adapter for settlement.
- **Neutrality:** self-hostable. Any issuer can construct and settle MPP tokens against Kaspa without Cadenza Labs in the loop.

## Status

Interface types only. Runtime implementation lands as v0.5 in Q3 2026 alongside the x402 Facilitator reference implementation. See the top-level [`README.md`](../../README.md) Protocol coverage section for the full roadmap.
