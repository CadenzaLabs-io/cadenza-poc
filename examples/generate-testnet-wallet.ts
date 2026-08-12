// Generate a Kaspa testnet-10 wallet keypair and print the address + private
// key. Save the private key in .env (or your shell) as KASPA_PRIVATE_KEY.
// Fund the address from https://faucet-tn10.kaspanet.io/ before using with
// the NativeKaspaAdapter.
//
// Usage: npx tsx examples/generate-testnet-wallet.ts

async function main() {
  // The package ships without an "exports" field so we import the file
  // directly. WASM initialization happens on first use via default export.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w: any = await import("@onekeyfe/kaspa-wasm/kaspa.js" as string);
  if (typeof w.default === "function") {
    await w.default(); // __wbg_init default export
  }

  const keypair = w.Keypair.random();
  const privateKeyHex = keypair.privateKey;
  const publicKeyHex = keypair.publicKey;
  const address = keypair.toAddress("testnet-10").toString();

  process.stdout.write("\n  ─────────────────────────────────────────────────────────\n");
  process.stdout.write("  Kaspa testnet-10 wallet generated\n");
  process.stdout.write("  ─────────────────────────────────────────────────────────\n\n");
  process.stdout.write(`  Address:     ${address}\n`);
  process.stdout.write(`  PublicKey:   ${publicKeyHex}\n`);
  process.stdout.write(`  PrivateKey:  ${privateKeyHex}\n\n`);
  process.stdout.write("  Next steps:\n");
  process.stdout.write("    1. Save the private key to .env or shell:\n");
  process.stdout.write(`         export KASPA_PRIVATE_KEY="${privateKeyHex}"\n`);
  process.stdout.write("    2. Fund the address at https://faucet-tn10.kaspanet.io/\n");
  process.stdout.write("    3. Wait ~10 seconds for the faucet tx to confirm\n");
  process.stdout.write("    4. Run: npm run testnet:smoke\n\n");
  process.stdout.write("  WARNING: this is a testnet keypair. Do NOT reuse for mainnet.\n\n");
}

main().catch((err) => {
  console.error("Wallet generation failed:", err);
  process.exit(1);
});
