"use client";

import { useState, useEffect, useMemo } from "react";

/**
 * Client-side pagination for operations module tables.
 * When `resetSignal` changes, the current page resets to 1.
 *
 * @param {unknown[]} items - filtered rows to paginate
 * @param {string|number} [resetSignal] - any value that should bump the user back to page 1 (filters, search, etc.)
 */
export function useOperationsClientPagination(items, resetSignal = "") {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [resetSignal]);

  const totalFiltered = items.length;

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [totalFiltered, pageSize, page]);

  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, totalFiltered);

  const paginatedItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalFiltered,
    totalPages,
    pageStart,
    pageEnd,
    paginatedItems,
  };
}
