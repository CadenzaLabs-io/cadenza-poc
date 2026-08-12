/**
 * Minimal RFC 8785 (JCS) canonical JSON serialization.
 *
 * Mandate integrity depends on hashing the *same* serialization that the
 * verifier will reproduce. JSON.stringify is not deterministic across
 * implementations (key order, number formatting). This module enforces
 * the JCS rules we need for the PoC: lexicographic key ordering, recursive
 * canonicalization of arrays/objects, no whitespace.
 *
 * Full JCS includes stricter number serialization (UTC-Z numbers). This
 * implementation covers the values our mandate subjects use (strings,
 * booleans, finite numbers, nested objects, arrays).
 */

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Non-finite numbers cannot be canonicalized");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Standard JSON behavior: object keys with `undefined` values are omitted.
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    const pairs = keys.map(
      (k) => JSON.stringify(k) + ":" + canonicalJson(obj[k]),
    );
    return "{" + pairs.join(",") + "}";
  }
  if (value === undefined) {
    // Should be filtered out at the parent object level; reaching here would
    // mean undefined as a top-level value, which is not a valid JSON type.
    throw new Error("Cannot canonicalize a top-level undefined value");
  }
  throw new Error(`Cannot canonicalize value of type ${typeof value}`);
}
