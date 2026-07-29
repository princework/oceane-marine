"use client";

import Link from "next/link";

/**
 * Icon-only action buttons for PMS / Operations tables (View, Edit, Delete, Download).
 * No archive. Use title/aria-label for accessibility.
 */

const btnBase =
  "inline-flex items-center justify-center rounded-lg border p-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40";

const eyePaths = (
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </>
);

const pencilPath = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
  />
);

export function ActionViewIcon({ onClick, title = "View", disabled, className = "", type = "button", ...rest }) {
  return (
    <button
      type={type}
      aria-label={title}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${btnBase} border-sky-400/50 text-sky-300 hover:bg-sky-500/15 ${className}`}
      {...rest}
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        {eyePaths}
      </svg>
    </button>
  );
}

export function ActionEditIcon({ onClick, title = "Edit", disabled, className = "", type = "button", ...rest }) {
  return (
    <button
      type={type}
      aria-label={title}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${btnBase} border-amber-400/50 text-amber-300 hover:bg-amber-500/15 ${className}`}
      {...rest}
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        {pencilPath}
      </svg>
    </button>
  );
}

export function ActionDeleteIcon({ onClick, title = "Delete", disabled, loading, className = "", type = "button", ...rest }) {
  return (
    <button
      type={type}
      aria-label={title}
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${btnBase} border-rose-400/50 text-rose-300 hover:bg-rose-500/15 min-w-[34px] min-h-[34px] ${className}`}
      {...rest}
    >
      {loading ? (
        <svg className="w-4 h-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      )}
    </button>
  );
}

/** Next.js Link styled like view icon */
export function ActionViewIconLink({ href, title = "View", className = "" }) {
  return (
    <Link
      href={href}
      aria-label={title}
      title={title}
      className={`${btnBase} border-sky-400/50 text-sky-300 hover:bg-sky-500/15 ${className}`}
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        {eyePaths}
      </svg>
    </Link>
  );
}

/** Next.js Link styled like edit icon */
export function ActionEditIconLink({ href, title = "Edit", className = "" }) {
  return (
    <Link
      href={href}
      aria-label={title}
      title={title}
      className={`${btnBase} border-amber-400/50 text-amber-300 hover:bg-amber-500/15 ${className}`}
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        {pencilPath}
      </svg>
    </Link>
  );
}

export function ActionDownloadIcon({ onClick, title = "Download", disabled, loading, className = "", type = "button", ...rest }) {
  return (
    <button
      type={type}
      aria-label={title}
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${btnBase} border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/15 min-w-[34px] min-h-[34px] ${className}`}
      {...rest}
    >
      {loading ? (
        <svg className="w-4 h-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )}
    </button>
  );
}
