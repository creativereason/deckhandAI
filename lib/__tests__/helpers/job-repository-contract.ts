// One behavior suite, run against every JobRepository implementation (Liskov: any
// backend must be substitutable). Only behavior that holds for every backend is
// asserted here; ids exist on Supabase only, so id behavior is tested separately.
import { describe, expect, it } from "vitest";
import type { JobRepository } from "@/lib/job-repository";
import type { JobsData } from "@/lib/jobs";

export interface ContractSubject {
  repo: JobRepository;
  /** Puts a board into the backend's storage before the repository is used. */
  seed(board: Partial<JobsData>): Promise<void>;
}

const EMPTY: JobsData = { applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] };
type Job = Record<string, unknown>;
const prospect = (role: string, extra: Job = {}): Job => ({ company: "Acme", role, fit: "good", salary: "", notes: "", url: "", ...extra });
const ref = (role: string, section: "prospect" | "passed" | "pending" = "prospect") => ({ section, company: "Acme", role });
const roles = (jobs: unknown[]) => (jobs as Job[]).map((j) => j.role);

export function describeJobRepositoryContract(name: string, make: () => ContractSubject): void {
  describe(`JobRepository contract: ${name}`, () => {
    // Z — Zero
    it("reads an empty board with every section present", async () => {
      expect(await make().repo.readBoard()).toEqual(EMPTY);
    });

    it("finds nothing in an empty board", async () => {
      const { repo } = make();

      expect(await repo.get(ref("A"))).toBeUndefined();
      expect(await repo.save(ref("A"), { section: "prospect", job: prospect("A") })).toBe(false);
      expect(await repo.archive(ref("A"))).toBe(false);
    });

    // O — One
    it("adds a job to the front of its section", async () => {
      const { repo, seed } = make();
      await seed({ prospect: [prospect("Old")] as never });

      await repo.add("prospect", prospect("New"));

      expect(roles((await repo.readBoard()).prospect)).toEqual(["New", "Old"]);
    });

    it("gets a job by section, company and role", async () => {
      const { repo, seed } = make();
      await seed({ prospect: [prospect("A"), prospect("B")] as never });

      const found = await repo.get(ref("B"));

      expect(found?.section).toBe("prospect");
      expect(found?.job.role).toBe("B");
    });

    // M — Many
    it("adds many jobs at once, last added first, like adding them one at a time", async () => {
      const { repo } = make();

      await repo.addMany("pending", [prospect("A"), prospect("B"), prospect("C")]);

      expect(roles((await repo.readBoard()).pending)).toEqual(["C", "B", "A"]);
    });

    it("patches each job with its own updates", async () => {
      const { repo, seed } = make();
      await seed({ prospect: [prospect("A"), prospect("B")] as never });

      const result = await repo.patch([
        { target: ref("A"), updates: { notes: "one" } },
        { target: ref("B"), updates: { notes: "two" } },
      ]);

      expect(result.updated).toBe(2);
      expect(((await repo.readBoard()).prospect as unknown as Job[]).map((j) => j.notes)).toEqual(["one", "two"]);
    });

    // B — Boundary
    it("saves a job in place without disturbing its neighbours", async () => {
      const { repo, seed } = make();
      await seed({ prospect: [prospect("A"), prospect("B"), prospect("C")] as never });

      await repo.save(ref("B"), { section: "prospect", job: prospect("B", { notes: "edited" }) });

      const board = (await repo.readBoard()).prospect as unknown as Job[];
      expect(board.map((j) => [j.role, j.notes])).toEqual([["A", ""], ["B", "edited"], ["C", ""]]);
    });

    it("moves a job to the front of another section", async () => {
      const { repo, seed } = make();
      await seed({ prospect: [prospect("Mover")] as never, passed: [prospect("Already")] as never });

      await repo.save(ref("Mover"), { section: "passed", job: prospect("Mover") });

      const board = await repo.readBoard();
      expect(board.prospect).toEqual([]);
      expect(roles(board.passed)).toEqual(["Mover", "Already"]);
    });

    it("keeps fields the schema does not know through save and patch", async () => {
      const { repo, seed } = make();
      await seed({ prospect: [prospect("A", { custom: { nested: true } })] as never });

      await repo.patch([{ target: ref("A"), updates: { notes: "n" } }]);

      expect(((await repo.readBoard()).prospect as unknown as Job[])[0]).toMatchObject({ custom: { nested: true }, notes: "n" });
    });

    it("removes an archived job from the board and leaves the others", async () => {
      const { repo, seed } = make();
      await seed({ prospect: [prospect("Keep"), prospect("Drop")] as never });

      expect(await repo.archive(ref("Drop"))).toBe(true);

      expect(roles((await repo.readBoard()).prospect)).toEqual(["Keep"]);
      expect(await repo.get(ref("Drop"))).toBeUndefined();
    });

    // B — Boundary: an agent must not add what is already tracked
    it("finds an existing job by URL", async () => {
      const { repo, seed } = make();
      await seed({ prospect: [prospect("A", { url: "https://x.test/1" })] as never });

      const found = await repo.findExisting({ url: "https://x.test/1", company: "Other", role: "Other" });

      expect(found?.section).toBe("prospect");
    });

    it("finds an existing job by company and role in any section", async () => {
      const { repo, seed } = make();
      await seed({ passed: [prospect("A")] as never });

      expect((await repo.findExisting({ url: "", company: "Acme", role: "A" }))?.section).toBe("passed");
    });

    it("finds nothing for a new job", async () => {
      const { repo, seed } = make();
      await seed({ prospect: [prospect("A", { url: "https://x.test/1" })] as never });

      expect(await repo.findExisting({ url: "https://x.test/2", company: "Acme", role: "B" })).toBeUndefined();
    });

    it("does not treat two jobs with no URL as the same job", async () => {
      const { repo, seed } = make();
      await seed({ prospect: [prospect("A", { url: "" })] as never });

      expect(await repo.findExisting({ url: "", company: "Other", role: "Other" })).toBeUndefined();
    });

    // I — Interface: patch reports what it could not find and still applies the rest
    it("reports unknown patch targets and still updates the others", async () => {
      const { repo, seed } = make();
      await seed({ prospect: [prospect("A")] as never });

      const result = await repo.patch([
        { target: ref("A"), updates: { notes: "x" } },
        { target: ref("Missing"), updates: { notes: "y" } },
      ]);

      expect(result).toEqual({ updated: 1, notFound: [ref("Missing")] });
    });

    // E — Exception: unknown jobs change nothing
    it("leaves the board untouched when the job is unknown", async () => {
      const { repo, seed } = make();
      await seed({ prospect: [prospect("A")] as never });
      const before = await repo.readBoard();

      await repo.save(ref("Nope"), { section: "passed", job: prospect("Nope") });
      await repo.archive(ref("Nope"));
      await repo.patch([{ target: ref("Nope"), updates: { notes: "x" } }]);
      await repo.addMany("pending", []);

      expect(await repo.readBoard()).toEqual(before);
    });
  });
}
