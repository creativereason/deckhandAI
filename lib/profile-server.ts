import { githubRead } from "@/lib/github";
import type { Profile } from "@/lib/profile";

const PATH = "data/profile.json";

export async function readProfile(): Promise<Profile> {
  try {
    const raw = await githubRead(PATH);
    return JSON.parse(raw) as Profile;
  } catch {
    return {};
  }
}
