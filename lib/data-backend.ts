import { usesLocalDemoFixtures } from "@/lib/demo-fixtures";

export type DataBackend = "github" | "supabase";

/** Selects where jobs and documents live. Unset means the original GitHub data repo. */
export function dataBackend(): DataBackend {
  const configured = process.env.DATA_BACKEND || "github";
  if (configured !== "github" && configured !== "supabase") {
    throw new Error(`DATA_BACKEND must be "github" or "supabase", got "${configured}"`);
  }
  // Screenshot runs write through an in-memory fixture store and must never touch a database.
  if (usesLocalDemoFixtures()) return "github";
  return configured;
}
