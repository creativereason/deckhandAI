// Agent API keys. A key is shown once at creation; only its SHA-256 hash is stored.
// The key is 32 random bytes, so a fast hash is enough: there is nothing to brute-force.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const AGENT_KEY_PREFIX = "dk_";
// Long enough to narrow a lookup to one row, short enough to show in a list.
const LOOKUP_PREFIX_LENGTH = AGENT_KEY_PREFIX.length + 8;

export interface GeneratedAgentKey {
  /** The secret. Show it to the user once; never store or log it. */
  key: string;
  /** SHA-256 of the key, hex. This is what gets stored. */
  hash: string;
  /** Non-secret start of the key, stored to find the row and to let a person tell keys apart. */
  prefix: string;
}

export function hashAgentKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function keyLookupPrefix(key: string): string {
  return key.slice(0, LOOKUP_PREFIX_LENGTH);
}

export function generateAgentKey(): GeneratedAgentKey {
  const key = `${AGENT_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { key, hash: hashAgentKey(key), prefix: keyLookupPrefix(key) };
}

/** Constant-time check that `key` is the one `storedHash` was made from. Never throws on bad input. */
export function verifyAgentKey(key: string, storedHash: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(storedHash)) return false;
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashAgentKey(key), "hex");
  return timingSafeEqual(actual, expected);
}
