import { readFileSync } from "fs";
import { resolve } from "path";
import { githubRead } from "@/lib/github";
import type { Profile } from "@/lib/profile";

const PATH = "data/profile.json";

export async function readProfile(): Promise<Profile> {
  try {
    if (process.env.DEMO_MODE === "true") {
      const persona = process.env.DEMO_PERSONA ?? "design";
      const file = persona === "dev" ? "data/profile-dev.sample.json"
        : persona === "onboarding" ? "data/profile-onboarding.sample.json"
        : "data/profile.sample.json";
      return JSON.parse(readFileSync(resolve(process.cwd(), file), "utf-8")) as Profile;
    }
    const raw = await githubRead(PATH);
    return JSON.parse(raw) as Profile;
  } catch {
    return {};
  }
}
