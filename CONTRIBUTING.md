# Contributing to Cadenza SDK

Thanks for your interest in Cadenza. This SDK is the reference implementation of the [Cadenza protocol](https://cadenzalabs.dev) — AP2 mandate settlement on Kaspa L1. It is developed under an open standard and welcomes contributions.

## Ways to contribute

- **File an issue** for bugs, unexpected behaviour, or missing test coverage.
- **Open a discussion** for design proposals, questions about the protocol, or ideas that don't yet have a concrete change attached.
- **Submit a pull request** for fixes, new tests, adapter implementations, and documentation improvements.

For non-trivial changes (new features, protocol-affecting behaviour, adapter contracts), please open an issue or discussion first so we can align on scope before you invest implementation effort.

## Development setup

Requirements: Node 20+.

```bash
git clone https://github.com/CadenzaLabs-io/cadenza-poc.git
cd cadenza-poc
npm install
npm test               # 23 tests, ~2s
npm run demo           # narrated end-to-end CLI walkthrough
npm run typecheck      # strict TS, no errors expected
```

If you want to exercise the live Kaspa L1 adapter (testnet-10):

```bash
npm run testnet:wallet   # generates a keypair; fund at faucet-tn10.kaspanet.io
export KASPA_PRIVATE_KEY="<hex from wallet output>"
npm run testnet:smoke    # posts a real testnet-10 tx
```

## Pull request conventions

- **Branch off `main`.** Name branches `feat/<short-slug>`, `fix/<short-slug>`, `docs/<short-slug>`, or `test/<short-slug>`.
- **One logical change per PR.** Refactors ride with the feature that needs them; drive-by cleanups go in a separate PR.
- **Tests are required for behaviour changes.** New features, adapter implementations, and bug fixes need a corresponding test.
- **Keep the diff readable.** Formatting-only changes to unrelated files should not appear in a feature PR.
- **Write PR descriptions that explain *why*, not just *what*.** The diff shows what; the description should show the motivation, the trade-offs considered, and what was rejected.

## Commit style

- Present tense, imperative mood: "Add native Kaspa adapter reconnect handling" not "Added" or "Adds".
- Reference issues in the body, not the subject line.
- Keep the subject line under ~70 characters.

## Code style

- TypeScript strict mode is on (`tsconfig.json`). Don't disable it.
- No new runtime dependencies without prior discussion. The SDK's zero-runtime-dep footprint is a design constraint, not an accident. Adapters may add dependencies as required for their target chain.
- No unnecessary comments. Well-named identifiers, small functions, and explicit types do the explaining. Comments are for *why*, not *what*.
- Follow the existing test structure (`tests/*.test.ts`, `node --test` via `tsx --test`).

## Adapter contributions

New adapters (chain integrations, alternative settlement backends) are welcome and follow the `KaspaAdapter` interface pattern in `src/adapter/types.ts`. Ship them alongside:

1. The adapter implementation in `src/adapter/<name>.ts`
2. A companion test file that exercises the adapter against a mock or testnet
3. A short section in `README.md` under "Architecture" describing what the adapter does and when to use it
4. Any new environment variables documented in `CONTRIBUTING.md` and `README.md`

## Contributor License Agreement (CLA)

Before we can merge your first pull request, you'll need to sign our Contributor License Agreement. This is standard for open-source infrastructure projects — it protects both you and the project by establishing a clean chain of intellectual-property ownership.

- **Individuals:** sign the [Individual CLA (ICLA)](./CLA-INDIVIDUAL.md). The Cadenza CLA bot will prompt you automatically when you open your first pull request; signing is a one-time comment on the PR.
- **Companies / employers:** if you're contributing on behalf of an employer, that employer should execute the [Corporate CLA (CCLA)](./CLA-CORPORATE.md). Email a signed copy to legal@cadenzalabs.dev to enroll your designated employees.

The CLA does not require you to transfer ownership of your work — you retain copyright. It grants Cadenza Labs the licences we need to distribute and (in future) re-licence the project, and includes standard patent-non-assertion provisions.

## Security

If you find a security issue, please **do not** open a public issue. Email security concerns to security@cadenzalabs.dev with the details, and we'll respond within two business days.

## Code of Conduct

Participation in this project is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md). By contributing, you agree to abide by its terms.

## Licence

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE) that covers this project, and (per the CLA) may be re-licensed by Cadenza Labs under alternative terms in future.
