import { describe, expect, it } from "vitest";
import { aboutJobPrompt, historyPrompt, pursuePrompt } from "@/lib/assistant-prompts";

const job = { company: "Acme", role: "Lead" };

describe("assistant prompts about a job", () => {
  // O — each names the job it is about
  it.each([["pursue", pursuePrompt], ["about", aboutJobPrompt], ["history", historyPrompt]])("%s prompt names the company and role", (_n, make) => {
    const text = make(job);
    expect(text).toContain("Acme");
    expect(text).toContain("Lead");
  });
  // B — the point of these helpers: bounded answers, stated as numbers the model can follow
  it("asks for at most three short points each way and a one-line verdict", () => {
    const text = pursuePrompt(job);
    expect(text).toMatch(/up to 3/i);
    expect(text).toMatch(/\d+ words/);
    expect(text).toMatch(/verdict/i);
  });
  it("caps the general job question at a word count", () => {
    expect(aboutJobPrompt(job)).toMatch(/under \d+ words/i);
  });
  it("asks for the history answer in two sentences", () => {
    expect(historyPrompt(job)).toMatch(/2 sentences/i);
  });
  // E — no pros-and-cons essay wording that invites length
  it("does not ask for the 'strongest reasons', which invited long answers", () => {
    expect(pursuePrompt(job)).not.toMatch(/strongest reasons/i);
  });
});
