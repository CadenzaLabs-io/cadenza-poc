import { test } from "node:test";
import assert from "node:assert";
import { Cadenza, mandateHash, verifyMandate } from "../src/index.js";
import { createIntentMandate } from "../src/mandates.js";

test("a fresh mandate verifies under its issuer's public key", () => {
  const c = new Cadenza();
  const user = c.createPrincipal();
  const agent = c.createPrincipal();
  const intent = createIntentMandate(user, agent, {
    spendCap: "100",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(verifyMandate(intent, user.publicKey), true);
});

test("a mandate does not verify under a different public key", () => {
  const c = new Cadenza();
  const user = c.createPrincipal();
  const other = c.createPrincipal();
  const agent = c.createPrincipal();
  const intent = createIntentMandate(user, agent, {
    spendCap: "100",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(verifyMandate(intent, other.publicKey), false);
});

test("tampering with the credentialSubject invalidates the signature", () => {
  const c = new Cadenza();
  const user = c.createPrincipal();
  const agent = c.createPrincipal();
  const intent = createIntentMandate(user, agent, {
    spendCap: "100",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  const tampered = JSON.parse(JSON.stringify(intent));
  tampered.credentialSubject.scope.spendCap = "999999";
  assert.equal(verifyMandate(tampered, user.publicKey), false);
});

test("tampering with the mandate also breaks the hash", () => {
  const c = new Cadenza();
  const user = c.createPrincipal();
  const agent = c.createPrincipal();
  const intent = createIntentMandate(user, agent, {
    spendCap: "100",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  const originalHash = mandateHash(intent);
  const tampered = JSON.parse(JSON.stringify(intent));
  tampered.credentialSubject.scope.spendCap = "999999";
  const tamperedHash = mandateHash(tampered);
  assert.notEqual(originalHash, tamperedHash);
});

test("nonce makes two mandates with identical params produce different hashes", () => {
  const c = new Cadenza();
  const user = c.createPrincipal();
  const agent = c.createPrincipal();
  const params = {
    spendCap: "100",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
  const a = createIntentMandate(user, agent, params);
  const b = createIntentMandate(user, agent, params);
  assert.notEqual(mandateHash(a), mandateHash(b));
});
