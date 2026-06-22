export type SortDir = "asc" | "desc";

export type SortState = {
  column: string;
  dir: SortDir;
};

const FIT_ORDER: Record<string, number> = {
  strong: 0,
  good: 1,
  caution: 2,
  weak: 3,
};

const STATUS_ORDER: Record<string, number> = {
  applied: 0,
  screening: 1,
  interview: 2,
  offer: 3,
  declined: 4,
};

function rankValue(value: string, order: Record<string, number>): number {
  return order[value.toLowerCase()] ?? 99;
}

function compareText(a: string, b: string, dir: SortDir): number {
  const r = (a || "").localeCompare(b || "", undefined, { sensitivity: "base" });
  return dir === "asc" ? r : -r;
}

export function nextSort(current: SortState | null, column: string): SortState {
  if (current?.column === column) {
    return { column, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  return { column, dir: "asc" };
}

export function sortRows<T>(
  rows: T[],
  sort: SortState,
  getValue: (row: T, column: string) => string
): T[] {
  const { column, dir } = sort;

  return [...rows].sort((a, b) => {
    const va = getValue(a, column);
    const vb = getValue(b, column);

    if (column === "fit") {
      const ra = rankValue(va, FIT_ORDER);
      const rb = rankValue(vb, FIT_ORDER);
      return dir === "asc" ? ra - rb : rb - ra;
    }

    if (column === "status") {
      const ra = rankValue(va, STATUS_ORDER);
      const rb = rankValue(vb, STATUS_ORDER);
      return dir === "asc" ? ra - rb : rb - ra;
    }

    if (column === "date") {
      const da = va ? new Date(va).getTime() : 0;
      const db = vb ? new Date(vb).getTime() : 0;
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return dir === "asc" ? da - db : db - da;
    }

    return compareText(va, vb, dir);
  });
}
