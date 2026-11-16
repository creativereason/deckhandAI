// Turns the model's reply into a TailoredResume, or a readable error. A long JSON answer that hits the
// model's output limit ends mid-structure, and JSON.parse's own message ("Unexpected end of JSON input")
// tells the user nothing about what happened.
import type { TailoredResume } from "@/app/api/tailor-resume/route";

const INCOMPLETE = "The model's reply was cut off before the tailored resume was complete. Try again; if it keeps happening, raise the model's output limit.";

const isTailoredResume = (value: unknown): value is TailoredResume => {
  const v = value as Partial<TailoredResume> | null;
  return !!v && typeof v.title === "string" && Array.isArray(v.profileBullets) && Array.isArray(v.experience);
};

export function parseTailoredResume(raw: string): TailoredResume {
  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  if (!cleaned) throw new Error("The model sent no reply. Try again.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(INCOMPLETE);
  }
  if (!isTailoredResume(parsed)) throw new Error("The model's reply was not a tailored resume. Try again.");
  return parsed;
}
