// Document-level storage for config, profile and scrape-targets. Same
// signatures as githubRead/githubWrite so callers swap by import only.
// Jobs are NOT handled here: they have a typed repository (lib/jobs-repository.ts).
import { dataBackend } from "@/lib/data-backend";
import { githubRead, githubWrite } from "@/lib/github";
import { getSupabase } from "@/lib/supabase";

const DOCUMENT_PATH = /^data\/(config|profile|scrape-targets)\.json$/;

function documentName(path: string): string {
  const match = DOCUMENT_PATH.exec(path);
  if (!match) throw new Error(`"${path}" is not stored in the documents table`);
  return match[1];
}

export async function readDataFile(path: string): Promise<string> {
  if (dataBackend() === "github") return githubRead(path);

  const name = documentName(path);
  const { data, error } = await getSupabase().from("documents").select("data").eq("name", name).maybeSingle();
  if (error) throw new Error(`Supabase read of "${name}" failed: ${error.message}`);
  if (!data) throw new Error(`Document "${name}" not found`);
  return JSON.stringify(data.data);
}

export async function writeDataFile(path: string, content: string, message: string): Promise<void> {
  if (dataBackend() === "github") return githubWrite(path, content, message);

  const name = documentName(path);
  const { error } = await getSupabase().from("documents").upsert({ name, data: JSON.parse(content) });
  if (error) throw new Error(`Supabase write of "${name}" failed: ${error.message}`);
}
