"use client";
import { createContext, useContext } from "react";

export type AssistantApi = {
  open: boolean;
  /** Open the assistant. With `text`, it is put in the composer; with `send`, it is sent straight away. */
  ask: (text?: string, options?: { send?: boolean }) => void;
  close: () => void;
};

const noop: AssistantApi = { open: false, ask: () => {}, close: () => {} };
export const AssistantContext = createContext<AssistantApi>(noop);

/** Any screen can start a conversation, e.g. ask("What are the red flags at Stripe?", { send: true }). */
export function useAssistant(): AssistantApi {
  return useContext(AssistantContext);
}

/** Fired after the assistant changes jobs so the current screen can reload its data. */
export const JOBS_CHANGED_EVENT = "deckhand:jobs-changed";
