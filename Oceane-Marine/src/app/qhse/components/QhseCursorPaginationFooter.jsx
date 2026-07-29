"use client";

export default function QhseCursorPaginationFooter({
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  loading = false,
  hint,
  /** When set, footer stays visible for a single full page (Prev/Next disabled). */
  itemCount,
}) {
  const listHasRows = typeof itemCount === "number" && itemCount > 0;
  if (!hasPrev && !hasNext && !listHasRows) return null;

  return (
    <div className="flex flex-col items-center gap-3 pt-4 border-t border-white/10 sm:flex-row sm:items-center sm:justify-between">
      {hint ? (
        <p className="text-center text-xs text-slate-300 sm:text-left">{hint}</p>
      ) : (
        <p className="text-center text-xs text-slate-300 sm:text-left">
          More results may be available. Use Next and Previous to move by page.
        </p>
      )}
      <div className="flex w-full flex-wrap justify-center gap-2 sm:w-auto sm:justify-end">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev || loading}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext || loading}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
