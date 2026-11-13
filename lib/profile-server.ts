import { readDataFile } from "@/lib/data-store";
import type { Profile } from "@/lib/profile";

const PATH = "data/profile.json";

export async function readProfile(): Promise<Profile> {
  try {
    const raw = await readDataFile(PATH);
    return JSON.parse(raw) as Profile;
  } catch {
    return {};
  }
}
