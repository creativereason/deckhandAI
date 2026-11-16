import type { ReactNode } from "react";

/** Fits the Deckhand chat card to the space its parent gives it, instead of its own full-height rail sizing. */
export default function AssistantSlot({ children }: { children: ReactNode }) {
  return <div className="min-h-0 min-w-0 lg:flex-1 lg:overflow-hidden lg:[&>div]:h-full lg:[&>div]:max-h-full">{children}</div>;
}
