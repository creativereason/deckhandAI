export type BoardLayout = "list" | "pipeline";

/** The list is the default: anything saved that is not "pipeline" (missing, old, corrupt) opens it. */
export function parseBoardLayout(saved: unknown): BoardLayout {
  return saved === "pipeline" ? "pipeline" : "list";
}
