import { test } from "node:test";
import assert from "node:assert";
import { canonicalJson } from "../src/canonical.js";

test("canonicalJson is deterministic regardless of key insertion order", () => {
  const a = { b: 2, a: 1, c: { z: 9, y: 8 } };
  const b = { a: 1, b: 2, c: { y: 8, z: 9 } };
  assert.equal(canonicalJson(a), canonicalJson(b));
});

test("canonicalJson sorts object keys lexicographically", () => {
  const obj = { banana: 1, apple: 2, cherry: 3 };
  assert.equal(canonicalJson(obj), '{"apple":2,"banana":1,"cherry":3}');
});

test("canonicalJson preserves array order", () => {
  assert.equal(canonicalJson([3, 1, 2]), "[3,1,2]");
});

test("canonicalJson handles nested arrays and objects", () => {
  const v = { x: [{ b: 2, a: 1 }, { d: 4, c: 3 }] };
  assert.equal(canonicalJson(v), '{"x":[{"a":1,"b":2},{"c":3,"d":4}]}');
});

test("canonicalJson handles primitives", () => {
  assert.equal(canonicalJson(null), "null");
  assert.equal(canonicalJson(true), "true");
  assert.equal(canonicalJson(false), "false");
  assert.equal(canonicalJson(42), "42");
  assert.equal(canonicalJson("hello"), '"hello"');
});
