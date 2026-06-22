"use client";
import type { SortState } from "@/lib/table-sort";

export default function SortableTh({
  label,
  column,
  sort,
  onSort,
  className = "text-left py-2 pr-4 font-medium",
}: {
  label: string;
  column: string;
  sort: SortState;
  onSort: (column: string) => void;
  className?: string;
}) {
  const active = sort.column === column;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 transition-colors ${
          active ? "text-gray-800 dark:text-gray-200" : ""
        }`}
      >
        {label}
        <span className="text-[10px] leading-none opacity-70">
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
