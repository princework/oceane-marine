"use client";

/**
 * Standard QHSE list page layout: one rounded container with
 * - Default: one row — search (left, flex-1) + filters (right)
 * - filtersOnSecondRow: full-width search on row 1; filters end-aligned on row 2
 * - Below: children (messages + table)
 * Use same structure across all QHSE modules. Filter options stay per-module.
 */
export function QhseListPageContainer({
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  filterChildren,
  children,
  filtersOnSecondRow = false,
}) {
  const searchInput = (
    <input
      type="text"
      placeholder={searchPlaceholder}
      className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-4 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
      value={searchValue}
      onChange={(e) => onSearchChange?.(e.target.value)}
    />
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl space-y-4 min-w-0">
      {filtersOnSecondRow ? (
        <div className="flex flex-col gap-4 min-w-0">
          <div className="w-full min-w-0">{searchInput}</div>
          <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-2">
            {filterChildren}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
          <div className="w-full min-w-0 sm:flex-1">{searchInput}</div>
          <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:w-auto sm:flex-shrink-0 sm:justify-end sm:gap-y-2">
            {filterChildren}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
