"use client";

/**
 * Shared action icon buttons with tooltips for QHSE list pages.
 * Use as button or anchor; pass title for tooltip and aria-label.
 */

/** Tooltip above the control (default for table rows). */
const tooltipAboveClass =
  "pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-50 px-2 py-1 text-xs font-medium text-white bg-slate-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap";
/** Tooltip below — use in sticky modal headers so it is not clipped. */
const tooltipBelowClass =
  "pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 px-2 py-1 text-xs font-medium text-white bg-slate-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap";
const iconClass = "w-5 h-5";

export function ArchiveIconButton({ onClick, disabled, loading, className = "" }) {
  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title="Archive"
        aria-label="Archive"
        className={`p-1.5 rounded text-slate-400 hover:text-slate-300 hover:bg-white/10 disabled:opacity-50 transition ${className}`}
      >
        {loading ? (
          <svg className={`${iconClass} animate-spin`} fill="none" viewBox="0 0 24 24" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        )}
      </button>
      <span className={tooltipAboveClass}>Archive</span>
    </span>
  );
}

/**
 * @param {{ tooltipPlacement?: "above" | "below" }} props – below = show tooltip under icon (modals / sticky headers)
 */
export function DownloadIconButton({
  href,
  onClick,
  disabled,
  loading,
  title: titleProp = "Download",
  className = "",
  tooltipPlacement = "above",
}) {
  const title = titleProp || "Download";
  const tooltipClass =
    tooltipPlacement === "below" ? tooltipBelowClass : tooltipAboveClass;
  const content = (
    <>
      {loading ? (
        <svg className={`${iconClass} animate-spin`} fill="none" viewBox="0 0 24 24" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )}
    </>
  );
  return (
    <span className="relative group inline-flex">
      {href ? (
        <a href={href} download title={title} aria-label={title} className={`p-1.5 rounded text-sky-400 hover:text-sky-300 hover:bg-white/10 transition inline-flex ${className}`}>
          {content}
        </a>
      ) : (
        <button type="button" onClick={onClick} disabled={disabled} title={title} aria-label={title} className={`p-1.5 rounded text-sky-400 hover:text-sky-300 hover:bg-white/10 disabled:opacity-50 transition inline-flex ${className}`}>
          {content}
        </button>
      )}
      <span className={tooltipClass}>{title}</span>
    </span>
  );
}

export function DeleteIconButton({ onClick, disabled, loading, className = "" }) {
  return (
    <span className="relative group inline-flex">
      <button type="button" onClick={onClick} disabled={disabled} title="Delete" aria-label="Delete" className={`p-1.5 rounded text-red-300 hover:text-red-200 hover:bg-red-500/10 disabled:opacity-50 transition ${className}`}>
        {loading ? (
          <svg className={`${iconClass} animate-spin`} fill="none" viewBox="0 0 24 24" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
      </button>
      <span className={tooltipAboveClass}>Delete</span>
    </span>
  );
}

export function ViewIconButton({ href, onClick, title = "View", className = "" }) {
  const icon = (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
  return (
    <span className="relative group inline-flex">
      {href ? (
        <a href={href} title={title} aria-label={title} className={`p-1.5 rounded text-sky-400 hover:text-sky-300 hover:bg-white/10 transition inline-flex ${className}`}>
          {icon}
        </a>
      ) : (
        <button type="button" onClick={onClick} title={title} aria-label={title} className={`p-1.5 rounded text-sky-400 hover:text-sky-300 hover:bg-white/10 transition inline-flex ${className}`}>
          {icon}
        </button>
      )}
      <span className={tooltipAboveClass}>{title}</span>
    </span>
  );
}

export function EditIconButton({ href, onClick, title = "Edit", className = "" }) {
  const icon = (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
  return (
    <span className="relative group inline-flex">
      {href ? (
        <a href={href} title={title} aria-label={title} className={`p-1.5 rounded text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition inline-flex ${className}`}>
          {icon}
        </a>
      ) : (
        <button type="button" onClick={onClick} title={title} aria-label={title} className={`p-1.5 rounded text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition inline-flex ${className}`}>
          {icon}
        </button>
      )}
      <span className={tooltipAboveClass}>{title}</span>
    </span>
  );
}

export function ApproveIconButton({ onClick, disabled, loading, approved, className = "" }) {
  return (
    <span className="relative group inline-flex">
      <button type="button" onClick={onClick} disabled={disabled} title="Approve" aria-label="Approve" className={`p-1.5 rounded disabled:opacity-50 transition inline-flex ${approved ? "text-emerald-500/60 cursor-not-allowed" : "text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10"} ${className}`}>
        {loading ? (
          <svg className={`${iconClass} animate-spin`} fill="none" viewBox="0 0 24 24" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </button>
      <span className={tooltipAboveClass}>Approve</span>
    </span>
  );
}

export function RejectIconButton({ onClick, disabled, loading, className = "" }) {
  return (
    <span className="relative group inline-flex">
      <button type="button" onClick={onClick} disabled={disabled} title="Reject" aria-label="Reject" className={`p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50 transition inline-flex ${className}`}>
        {loading ? (
          <svg className={`${iconClass} animate-spin`} fill="none" viewBox="0 0 24 24" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </button>
      <span className={tooltipAboveClass}>Reject</span>
    </span>
  );
}
