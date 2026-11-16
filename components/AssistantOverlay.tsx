"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Keeps Your Deckhand one click away on full-width views, without taking a column from them. */
export default function AssistantOverlay({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div role="dialog" aria-label="Your Deckhand" className="fixed bottom-20 right-4 top-4 z-40 flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl shadow-xl [&>div]:h-full [&>div]:max-h-full">
          {children}
        </div>
      )}
      <Button className="fixed bottom-4 right-4 z-40 rounded-full shadow-lg" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? "Close Deckhand" : "Ask Deckhand"}
      </Button>
    </>
  );
}
