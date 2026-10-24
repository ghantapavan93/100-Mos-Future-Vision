// Deterministic hashing and structural diffs for the audit chain. Not
// cryptographic: the chain makes accidental or silent edits visible in a demo,
// it does not defend against an attacker (a production ledger would use
// SHA-256 and server-side signing).

/** JSON with object keys sorted, so equal values always serialise identically. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** FNV-1a, 32-bit, as 8 hex characters. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function hashOf(value: unknown): string {
  return fnv1a(stableStringify(value));
}

export interface Change {
  path: string;
  before: unknown;
  after: unknown;
}

/** A safety bound against pathological commands; receipts record the full count and say when they show fewer. */
const MAX_CHANGES = 2000;

/**
 * Leaf-level differences between two plain JSON values. Arrays of primitives
 * and arrays of objects are compared as whole values, which keeps an RSVP list
 * change to one readable line instead of a cascade of index shifts.
 */
export function diff(before: unknown, after: unknown, path = "", out: Change[] = []): Change[] {
  if (out.length >= MAX_CHANGES) return out;
  if (Object.is(before, after)) return out;
  const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
  if (isObj(before) && isObj(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort()) diff(before[key], after[key], path ? `${path}.${key}` : key, out);
    return out;
  }
  if (Array.isArray(before) && Array.isArray(after) && stableStringify(before) === stableStringify(after)) return out;
  out.push({ path, before: summarise(before), after: summarise(after) });
  return out;
}

/** Keep large values readable in a receipt. */
function summarise(value: unknown): unknown {
  if (value === undefined) return null;
  const text = stableStringify(value);
  if (text.length <= 240) return value;
  if (Array.isArray(value)) return `[${value.length} items]`;
  return `${text.slice(0, 200)}…`;
}
