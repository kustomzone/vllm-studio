"use client";

import type { SortDirection } from "@/lib/types";

interface TableSortingOptions {
  currentField: string;
  thisField: string;
  sortDirection: SortDirection;
  label: string;
}

function TableSorting({
  currentField,
  thisField,
  sortDirection,
  label,
}: TableSortingOptions) {
  return (
    <div
      className={`text-left py-3 px-3 font-normal cursor-pointer hover:text-(--foreground) transition-colors`}
      onClick={() => { /* Sort handler to be attached by parent */ }}
    >
      {label}{" "}
      {currentField === thisField && (sortDirection === "asc" ? "↑" : "↓")}
    </div>
  );
}

export { TableSorting };
