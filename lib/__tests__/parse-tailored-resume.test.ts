import { describe, expect, it } from "vitest";
import { parseTailoredResume } from "@/lib/parse-tailored-resume";

const valid = { title: "Director — Design", profileBullets: ["a"], experience: [{ company: "Acme", role: "Lead", bullets: ["x"] }] };

describe("parseTailoredResume", () => {
  // O
  it("parses plain JSON", () => {
    expect(parseTailoredResume(JSON.stringify(valid))).toEqual(valid);
  });
  // B — models wrap JSON in fences even when told not to
  it("strips a markdown fence around the JSON", () => {
    expect(parseTailoredResume("```json\n" + JSON.stringify(valid) + "\n```")).toEqual(valid);
  });
  // E — the reported bug: a reply cut off mid-JSON must say so, not leak the parser's message
  it("says the reply was cut off when the JSON is incomplete", () => {
    const cut = JSON.stringify(valid).slice(0, 60);
    expect(() => parseTailoredResume(cut)).toThrow(/cut off|incomplete/i);
    expect(() => parseTailoredResume(cut)).not.toThrow(/Unexpected end of JSON/);
  });
  it("says so for an empty reply too", () => {
    expect(() => parseTailoredResume("")).toThrow(/no reply|cut off|incomplete/i);
  });
  // E — valid JSON of the wrong shape would crash the diff view later
  it("rejects JSON that is not a tailored resume", () => {
    expect(() => parseTailoredResume('{"hello":"world"}')).toThrow(/tailored resume/i);
  });
});
