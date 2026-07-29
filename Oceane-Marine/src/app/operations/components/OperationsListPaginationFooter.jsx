"use client";

import OperationsSelectField from "./OperationsSelectField";

const DEFAULT_SIZES = [10, 25, 50, 100];

/**
 * Shared table footer: range text, rows-per-page, prev/next.
 */
export default function OperationsListPaginationFooter({
  totalFiltered,
  page,
  setPage,
  totalPages,
  pageStart,
  pageEnd,
  pageSize,
  setPageSize,
  pageSizeOptions = DEFAULT_SIZES,
  className = "",
}) {
  if (totalFiltered <= 0) return null;

  return (
    <div
      className={`relative z-20 overflow-visible flex flex-col gap-3 border-t border-white/10 bg-white/3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${className}`.trim()}
    >
      <div className="flex min-w-0 flex-col gap-2 text-sm text-white/70 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <span className="shrink-0">
          Showing{" "}
          <span className="font-semibold text-white">
            {pageStart}–{pageEnd}
          </span>{" "}
          of <span className="font-semibold text-white">{totalFiltered}</span>
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="shrink-0 text-white/50">Rows per page</span>
          <OperationsSelectField
            variant="pill"
            searchable={false}
            menuPlacement="top"
            ariaLabel="Rows per page"
            value={String(pageSize)}
            onChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
            options={pageSizeOptions.map((n) => ({
              value: String(n),
              label: String(n),
            }))}
            triggerClassName="ops-select-trigger min-h-0 w-full min-w-[3rem] justify-between rounded-lg px-2 py-1 text-xs uppercase tracking-wide"
            className="relative z-30 w-14 min-w-[3.5rem] shrink-0"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="min-w-20 text-center text-sm text-white/80">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
