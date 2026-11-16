// The rules for working through the inbox one job at a time. Pure, so the view and its
// keyboard shortcuts are testable without a browser.

export type TriageAction = "pass" | "keep" | "skip" | "back";
export type InboxMode = "triage" | "list";

const mod = (n: number, size: number) => ((n % size) + size) % size;

/** The queue starting at `offset`, wrapping round: skipping moves on, and nothing is ever lost. */
export function rotateQueue<T>(queue: readonly T[], offset: number): T[] {
  if (queue.length === 0) return [];
  const start = mod(offset, queue.length);
  return [...queue.slice(start), ...queue.slice(0, start)];
}

export function stepOffset(offset: number, delta: number, size: number): number {
  return size === 0 ? 0 : mod(offset + delta, size);
}

/**
 * The offset to hold while the current job leaves the queue (passed or kept): the job after
 * it then lands on the same offset in the shorter list and becomes current.
 */
export function settleOffset(offset: number, size: number): number {
  return size === 0 ? 0 : mod(offset, size);
}

interface KeyPress {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  targetTag?: string;
  isEditable?: boolean;
}

const KEY_ACTIONS: Record<string, TriageAction> = {
  p: "pass",
  k: "keep",
  s: "skip",
  arrowright: "skip",
  arrowleft: "back",
};

const TYPING_TAGS = ["INPUT", "TEXTAREA", "SELECT"];

/** A shortcut never fires while the user is typing or holding a browser shortcut modifier. */
export function triageKeyAction(press: KeyPress): TriageAction | undefined {
  if (press.ctrlKey || press.metaKey || press.altKey || press.isEditable) return undefined;
  if (press.targetTag && TYPING_TAGS.includes(press.targetTag.toUpperCase())) return undefined;
  return KEY_ACTIONS[press.key.toLowerCase()];
}

export function inboxModeFromStorage(saved: string | null): InboxMode {
  return saved === "list" ? "list" : "triage";
}
