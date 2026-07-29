import mongoose from "mongoose";

export const DEFAULT_CURSOR_LIMIT = 10;
export const MAX_CURSOR_LIMIT = 50;

export function parseObjectIdCursor(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  try {
    return new mongoose.Types.ObjectId(value);
  } catch {
    return null;
  }
}

export function clampCursorLimit(raw) {
  const n = Number.parseInt(String(raw), 10);
  if (Number.isNaN(n) || n < 1) return DEFAULT_CURSOR_LIMIT;
  return Math.min(n, MAX_CURSOR_LIMIT);
}

/**
 * Merge `_id: { $lt: cursor }` into a filter for descending _id cursor pages.
 * @param {Record<string, unknown>} filter
 * @param {string | null | undefined} cursor
 */
export function mergeIdLtFilter(filter, cursor) {
  const oid = parseObjectIdCursor(cursor);
  const base = filter && typeof filter === "object" ? { ...filter } : {};
  if (oid) base._id = { $lt: oid };
  return base;
}

/**
 * Cursor page using stable sort on `_id` descending.
 * @param {import("mongoose").Model} Model
 * @param {Record<string, unknown>} baseFilter
 * @param {{ cursor?: string | null; limit?: number; sort?: Record<string, 1 | -1>; select?: string }} options
 */
export async function findWithMongoIdCursor(Model, baseFilter, options) {
  const { cursor, limit, sort, select } = options;
  const lim = clampCursorLimit(limit);
  const filter = mergeIdLtFilter(baseFilter, cursor);
  let q = Model.find(filter).sort(sort || { _id: -1 }).limit(lim + 1);
  if (select) q = q.select(select);
  const docs = await q.lean();
  const hasNext = docs.length > lim;
  const items = hasNext ? docs.slice(0, lim) : docs;
  const nextCursor =
    hasNext && items.length > 0 ? String(items[items.length - 1]._id) : null;
  return { items, nextCursor, hasNext };
}
