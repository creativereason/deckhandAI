import { describe, expect, it } from "vitest";
import { AGENT_KEY_PREFIX, generateAgentKey, hashAgentKey, keyLookupPrefix, verifyAgentKey } from "@/lib/agent-keys";

describe("generateAgentKey", () => {
  // O — One
  it("returns a key that starts with the dk_ marker and is long enough to be unguessable", () => {
    const { key } = generateAgentKey();

    expect(key.startsWith(AGENT_KEY_PREFIX)).toBe(true);
    expect(key.length).toBeGreaterThanOrEqual(40);
  });

  // M — Many
  it("never returns the same key twice", () => {
    expect(new Set(Array.from({ length: 50 }, () => generateAgentKey().key)).size).toBe(50);
  });

  // B — Boundary: only the hash is ever stored, so it must not contain the key
  it("returns a hash that differs from, and does not reveal, the key", () => {
    const { key, hash } = generateAgentKey();

    expect(hash).not.toContain(key);
    expect(hash).toBe(hashAgentKey(key));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a short lookup prefix that is part of the key", () => {
    const { key, prefix } = generateAgentKey();

    expect(key.startsWith(prefix)).toBe(true);
    expect(prefix).toBe(keyLookupPrefix(key));
    expect(prefix.length).toBeLessThan(key.length / 2);
  });
});

describe("verifyAgentKey", () => {
  it("accepts the key a hash was made from", () => {
    const { key, hash } = generateAgentKey();

    expect(verifyAgentKey(key, hash)).toBe(true);
  });

  // E — Exception
  it("rejects a different key, an empty key and the hash itself", () => {
    const { key, hash } = generateAgentKey();

    expect(verifyAgentKey(generateAgentKey().key, hash)).toBe(false);
    expect(verifyAgentKey("", hash)).toBe(false);
    expect(verifyAgentKey(hash, hash)).toBe(false);
    expect(verifyAgentKey(key, hash)).toBe(true);
  });

  it("rejects a key with a single character changed", () => {
    const { key, hash } = generateAgentKey();
    const altered = key.slice(0, -1) + (key.endsWith("A") ? "B" : "A");

    expect(verifyAgentKey(altered, hash)).toBe(false);
  });

  it("rejects a malformed stored hash instead of throwing", () => {
    expect(verifyAgentKey("dk_whatever", "not-hex")).toBe(false);
    expect(verifyAgentKey("dk_whatever", "")).toBe(false);
  });
});
