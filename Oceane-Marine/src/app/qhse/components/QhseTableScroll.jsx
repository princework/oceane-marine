"use client";

/**
 * Wraps a wide data table so small viewports scroll horizontally.
 * Uses global `.qhse-table-scroll` for theme-matched scrollbar (see globals.css).
 */
export function QhseTableScroll({ children, className = "" }) {
  return (
    <div
      className={`qhse-table-scroll min-w-0 w-full overflow-x-auto overscroll-x-contain lg:overflow-x-visible [-webkit-overflow-scrolling:touch] ${className}`.trim()}
    >
      {children}
    </div>
  );
}
