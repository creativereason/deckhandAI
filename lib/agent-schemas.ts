// Request bodies for managing agents (Security Invariant 2).
import { z } from "zod";
import { AGENT_SCOPES } from "@/lib/agent-scopes";

const ScopeList = z
  .array(z.enum(AGENT_SCOPES))
  .min(1, "an agent needs at least one scope")
  .transform((scopes) => [...new Set(scopes)]);

// The name becomes the actor in the event log, so keep it plain: no markup, quotes or control characters.
const AgentName = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 _-]*$/, "use letters, numbers, spaces, - and _");

export const CreateAgentBody = z.object({ name: AgentName, scopes: ScopeList.optional() });

/** Only scopes can change; anything else in the body is ignored, so a name or key can never be altered here. */
export const UpdateAgentBody = z.object({ scopes: ScopeList });

export const AgentId = z.uuid();
