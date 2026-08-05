"use client";

import { useState, useEffect, useRef, useId, useMemo } from "react";

function FieldLabel({ children, labelId, triggerId }) {
  return (
    <label
      id={labelId}
      htmlFor={triggerId}
      className="mb-2 block text-sm font-semibold text-white/80"
    >
      {children}
    </label>
  );
}

const FORM_TRIGGER =
  "flex min-h-[2.75rem] w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 pr-10 text-left text-sm shadow-lg shadow-black/20 outline-none transition focus:border-orange-400/60 focus:ring-2 focus:ring-orange-500/40";

const PILL_TRIGGER =
  "ops-select-trigger flex min-h-[2.25rem] w-full min-w-0 items-center justify-between gap-2 rounded-full py-2 pl-3 pr-10 text-left text-[11px] font-medium uppercase tracking-wide sm:px-3 sm:text-xs";

/**
 * Custom dropdown so the menu matches trigger width on mobile (native select does not).
 * - variant "form": documentation-style field with label.
 * - variant "pill": ops-select-trigger filters in list headers (no CSS chevron; SVG only).
 * - Pass value + onChange for controlled usage; pass name (+ optional defaultValue) for FormData / draft restore.
 * - searchable (default true): filter options by label/value when the panel is open (set false for tiny lists e.g. rows-per-page).
 */
export default function OperationsSelectField({
  label,
  options = [],
  loading = false,
  name,
  multiple = false,
  placeholder,
  size,
  onChange,
  defaultValue,
  value: valueProp,
  variant = "form",
  ariaLabel,
  id: idProp,
  triggerClassName,
  listClassName,
  className = "",
  disabled = false,
  searchable = true,
  /** "bottom" (default) or "top" — use "top" in table footers so the list is not clipped. */
  menuPlacement = "bottom",
  /** Increment to clear selection (e.g. when parent form resets). */
  resetKey,
}) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const triggerId = idProp ?? `${baseId}-trigger`;
  const searchInputId = `${baseId}-search`;
  const isControlled = valueProp !== undefined;
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const hideRef = useRef(null);
  const rootRef = useRef(null);
  const searchInputRef = useRef(null);
  const [internalSelected, setInternalSelected] = useState(() =>
    defaultValue === undefined || defaultValue === null ? "" : String(defaultValue)
  );

  const selected = isControlled
    ? valueProp === undefined || valueProp === null
      ? ""
      : String(valueProp)
    : internalSelected;

  useEffect(() => {
    if (isControlled || !name) return;
    const next =
      defaultValue === undefined || defaultValue === null ? "" : String(defaultValue);
    setInternalSelected((prev) => (prev === next ? prev : next));
  }, [defaultValue, isControlled, name]);

  useEffect(() => {
    if (resetKey === undefined || isControlled) return;
    setInternalSelected("");
  }, [resetKey, isControlled]);

  /* Notify parent form for draft autosave after React updates the hidden input value. */
  useEffect(() => {
    if (isControlled || !name) return;
    const el = hideRef.current;
    if (!el) return;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, [internalSelected, isControlled, name]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setSearchQuery("");
  }, [open]);

  useEffect(() => {
    if (!open || !searchable || loading) return;
    const id = requestAnimationFrame(() => {
      const el = searchInputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [open, searchable, loading]);

  const normalized = useMemo(
    () =>
      options.map((opt) => {
        if (typeof opt === "object" && opt !== null) {
          return {
            value: String(opt.value ?? ""),
            label: String(opt.label ?? ""),
            /** Flags the option (and the trigger, when it's the current selection) red — e.g. a mooring master with incomplete/expired POAC documents. */
            warn: Boolean(opt.warn),
          };
        }
        const s = String(opt);
        return { value: s, label: s, warn: false };
      }),
    [options]
  );

  const filteredNormalized = useMemo(() => {
    if (!searchable) return normalized;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [normalized, searchQuery, searchable]);

  const commit = (val) => {
    const str = val == null ? "" : String(val);
    if (!isControlled) {
      setInternalSelected(str);
    }
    if (onChange) onChange(str);
  };

  const selectedOption = normalized.find((o) => o.value === selected);
  const selectedWarn = !loading && selected !== "" && Boolean(selectedOption?.warn);

  const selectedLabel = (() => {
    if (loading) return "Loading...";
    if (selected === "" && placeholder) return placeholder;
    if (selectedOption) return selectedOption.label;
    return placeholder || "Select";
  })();

  const placeholderLike =
    variant === "form" && !loading && selected === "" && !!placeholder;

  /* Custom triggers must be a single-row flex layout or the label + chevron stack and the control looks too tall. */
  const triggerBase = triggerClassName
    ? `${triggerClassName} flex w-full min-h-0 items-center justify-between gap-2 pr-10 text-left`
    : variant === "pill"
      ? PILL_TRIGGER
      : FORM_TRIGGER;

  const toneClass = triggerClassName
    ? ""
    : selectedWarn
      ? "font-semibold text-red-400"
      : `${placeholderLike ? "font-normal text-white/60" : "font-semibold text-white"}`;

  const menuPositionClass =
    menuPlacement === "top"
      ? "absolute left-0 right-0 bottom-full z-[200] mb-1"
      : "absolute left-0 right-0 top-full z-[200] mt-1";

  const dropdownPanelClass =
    listClassName ??
    (variant === "pill"
      ? `${menuPositionClass} flex min-h-0 max-h-60 min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b2740] text-xs shadow-xl`
      : `${menuPositionClass} flex min-h-0 max-h-60 min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b2740] shadow-xl`);

  /* Explicit list max-height when a search row is present — flex-1 alone inside max-h-only parents often collapses the scroll area to ~one row. */
  const listScrollClass =
    "ops-select-list-scroll min-h-0 overflow-y-auto overflow-x-hidden py-1 " +
    (searchable ? "max-h-[11.25rem]" : "flex-1");

  const optionBtn =
    variant === "pill"
      ? "w-full max-w-full truncate px-3 py-2 text-left text-[11px] uppercase tracking-wide hover:bg-[#1b3d5c] sm:text-xs"
      : "w-full max-w-full truncate px-3 py-2 text-left text-sm hover:bg-[#1b3d5c]";

  if (multiple) {
    return (
      <div className={`space-y-2 ${className}`.trim()}>
        {label != null && label !== "" && (
          <FieldLabel labelId={labelId} triggerId={triggerId}>
            {label}
          </FieldLabel>
        )}
        <div className="relative min-w-0">
          <select
            id={triggerId}
            name={name}
            multiple
            size={size}
            disabled={disabled || loading}
            onChange={(e) => {
              if (onChange) onChange(e.target.value);
            }}
            aria-label={ariaLabel}
            className="min-h-[160px] w-full appearance-auto rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 outline-none transition focus:border-orange-400/60 focus:ring-2 focus:ring-orange-500/40 disabled:opacity-60"
          >
            {loading && (
              <option disabled className="text-slate-900">
                Loading...
              </option>
            )}
            {!loading &&
              options.map((opt) => {
                const v = typeof opt === "object" ? opt.value : opt;
                const text = typeof opt === "object" ? opt.label : opt;
                return (
                  <option key={v ?? text} value={v} className="text-slate-900">
                    {text}
                  </option>
                );
              })}
          </select>
        </div>
      </div>
    );
  }

  const showLabel = label != null && label !== "" && variant === "form";

  return (
    <div
      className={`${showLabel ? "space-y-2" : ""} ${className} ${open ? "relative z-[9999]" : ""}`.trim()}
      ref={rootRef}
    >
      {showLabel && (
        <FieldLabel labelId={labelId} triggerId={triggerId}>
          {label}
        </FieldLabel>
      )}
      <div className="relative min-w-0">
        {name ? (
          <input
            ref={hideRef}
            type="hidden"
            name={name}
            value={selected}
            readOnly
            tabIndex={-1}
            aria-hidden
          />
        ) : null}
        <button
          type="button"
          id={triggerId}
          disabled={disabled || loading}
          aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={showLabel ? labelId : undefined}
          onClick={() => !(disabled || loading) && setOpen((v) => !v)}
          className={`operations-select-trigger ${triggerBase} ${toneClass} ${
            loading || disabled ? "cursor-not-allowed opacity-60" : ""
          }`.trim()}
        >
          <span className="min-w-0 flex-1 truncate text-left">{selectedLabel}</span>
          <svg
            className={`pointer-events-none h-4 w-4 shrink-0 self-center ${variant === "pill" ? "text-slate-200" : "text-orange-300"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && !loading && (
          <div className={dropdownPanelClass} role="presentation">
            {searchable && (
              <div className="shrink-0 border-b border-white/10 p-2">
                <label htmlFor={searchInputId} className="sr-only">
                  Search options
                </label>
                <input
                  ref={searchInputRef}
                  id={searchInputId}
                  type="search"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-lg border border-white/15 bg-[#071f33] px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-orange-400/50 focus:ring-1 focus:ring-orange-500/30"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpen(false);
                    }
                  }}
                />
              </div>
            )}
            <ul
              className={listScrollClass}
              role="listbox"
              aria-labelledby={showLabel ? labelId : undefined}
              aria-label={!showLabel ? ariaLabel : undefined}
            >
              {filteredNormalized.length === 0 ? (
                <li className="px-3 py-2 text-left text-sm text-white/50" role="presentation">
                  No matches
                </li>
              ) : (
                filteredNormalized.map((opt) => (
                  <li key={opt.value === "" ? "__empty" : opt.value} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected === opt.value}
                      className={`${optionBtn} ${
                        opt.warn
                          ? selected === opt.value
                            ? "bg-[#1b3d5c]/90 text-red-400"
                            : "text-red-400 hover:text-red-300"
                          : selected === opt.value
                            ? "bg-[#1b3d5c]/90 text-white"
                            : "text-slate-200"
                      }`}
                      onClick={() => {
                        commit(opt.value);
                        setOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
