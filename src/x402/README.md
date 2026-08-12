# `x402/` — Kaspa L1 Facilitator (Reference Implementation)

Scaffold for Cadenza's reference implementation of the **x402 Facilitator role** on Kaspa L1. Currently type interfaces only; runtime implementation ships as `v0.4` in Q3 2026.

## What lives here (planned)

The Facilitator surface described in the [x402 Facilitator specification](https://cadenzalabs.dev/docs):

- `POST /verify` — validate a payment payload without on-chain submission
- `POST /settle` — verify + submit; return settlement receipt referenced back into the HTTP-402 response
- `POST /reconcile` — resource-server-initiated reconciliation query against an on-chain hash

Backed by the existing Cadenza SDK primitives (canonical JSON, Ed25519 signing, chain-hash validation) and the native Kaspa L1 adapter shipped in v0.1.

**MIT-licensed, reference implementation tier.** The production Facilitator — with hardened endpoint pool, rate limiting, session persistence, and per-issuer compliance hooks — lives in a separate Cadenza Labs repository under Business Source Licence 1.1, targeted alongside AP2 mainnet cutover in Q4 2026. See the top-level [`README.md`](../../README.md) for the full open-core architecture.

## Contract

- **Interface:** exposed via HTTP endpoints as specified; TypeScript-level types in [`./types.ts`](./types.ts).
- **Dependencies:** consumes the SDK's mandate validation, adapter dispatch, and settlement transaction assembly. Does not introduce new Kaspa-side primitives.
- **Neutrality:** self-hostable. Any resource server or client can run their own Facilitator against Kaspa without Cadenza Labs in the loop.

## Status

Interface types only. Runtime implementation lands as v0.4 in Q3 2026 alongside the MPP reference implementation. See the top-level [`README.md`](../../README.md) Protocol coverage section for the full roadmap.
