import { githubRead } from "@/lib/github";
import { readLocalDemoFixture, usesLocalDemoFixtures } from "@/lib/demo-fixtures";
import type { Profile } from "@/lib/profile";

const PATH = "data/profile.json";

export async function readProfile(): Promise<Profile> {
  if (usesLocalDemoFixtures()) {
    return readLocalDemoFixture("profile", {});
  }
  try {
    const raw = await githubRead(PATH);
    return JSON.parse(raw) as Profile;
  } catch {
    return {};
  }
}
