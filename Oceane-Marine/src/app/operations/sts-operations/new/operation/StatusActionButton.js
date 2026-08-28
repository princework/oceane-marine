"use client";

const TONES = {
  emerald: "border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/15",
  red: "border-rose-400/50 text-rose-300 hover:bg-rose-500/15",
};

/** Small pill button for the Mark Complete / Cancel Operation row actions. */
export default function StatusActionButton({ label, onClick, tone = "emerald", loading, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${TONES[tone]}`}
    >
      {loading ? "…" : label}
    </button>
  );
}
