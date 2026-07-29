"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cursor-based list using Mongo `_id` descending pages and a prev stack.
 * @template {{ _id: string }} T
 * @param {(requestAfterExclusiveId: string | null) => Promise<{ items: T[]; hasNext: boolean }>} loadPage
 * @param {string} resetKey when this changes, the list resets to the first page
 */
export function useQhseMongoCursorList(loadPage, resetKey) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [, setStackVersion] = useState(0);

  const itemsRef = useRef([]);
  const hasNextRef = useRef(false);
  const requestCursorRef = useRef(null);
  const stackRef = useRef([]);
  const loadPageRef = useRef(loadPage);
  loadPageRef.current = loadPage;

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    hasNextRef.current = hasNext;
  }, [hasNext]);

  const runFetch = useCallback(async (requestCursor) => {
    setLoading(true);
    setError(null);
    try {
      const { items: rows, hasNext: more } = await loadPageRef.current(
        requestCursor
      );
      const list = rows || [];
      setItems(list);
      setHasNext(!!more);
      requestCursorRef.current = requestCursor;
      itemsRef.current = list;
      hasNextRef.current = !!more;
    } catch (e) {
      setError(e?.message || "Failed to load");
      setItems([]);
      setHasNext(false);
      requestCursorRef.current = requestCursor;
      itemsRef.current = [];
      hasNextRef.current = false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    stackRef.current = [];
    setStackVersion((v) => v + 1);
    void runFetch(null);
  }, [resetKey, runFetch]);

  const hasPrev = stackRef.current.length > 0;

  const goNext = useCallback(async () => {
    const rows = itemsRef.current;
    if (!rows.length || !hasNextRef.current) return;
    const lastId = String(rows[rows.length - 1]._id);
    stackRef.current.push(requestCursorRef.current);
    setStackVersion((v) => v + 1);
    await runFetch(lastId);
  }, [runFetch]);

  const goPrev = useCallback(async () => {
    if (stackRef.current.length === 0) return;
    const prevCursor = stackRef.current.pop();
    setStackVersion((v) => v + 1);
    await runFetch(prevCursor ?? null);
  }, [runFetch]);

  const refreshFirstPage = useCallback(async () => {
    stackRef.current = [];
    setStackVersion((v) => v + 1);
    await runFetch(null);
  }, [runFetch]);

  return {
    items,
    loading,
    error,
    setError,
    hasNext,
    hasPrev,
    goNext,
    goPrev,
    refreshFirstPage,
    setItems,
  };
}
