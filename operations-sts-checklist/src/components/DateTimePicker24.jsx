"use client";

import { useState, useRef, useEffect } from "react";
import { HOURS_24, MINUTES_60, toDateTimeLocalValue } from "@/lib/datetime24";

const inputClass =
  "bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-gray-400";

function TimeSelect({ value, options, disabled, ariaLabel, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      const active = listRef.current.querySelector('[data-active="true"]');
      if (active) active.scrollIntoView({ block: "center" });
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`${inputClass} w-[4.25rem] text-left flex items-center justify-between gap-1 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span>{value}</span>
        <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded border border-gray-600 bg-gray-800 shadow-lg scrollbar-thin"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((opt) => (
            <li
              key={opt}
              role="option"
              aria-selected={opt === value}
              data-active={opt === value ? "true" : undefined}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                opt === value
                  ? "bg-orange-500/30 text-orange-200 font-semibold"
                  : "text-white hover:bg-gray-700"
              }`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Date + time picker using 24-hour clock (00–23), not browser AM/PM datetime-local UI.
 * Value/onChange use `YYYY-MM-DDTHH:mm` (same contract as datetime-local for APIs).
 */
export default function DateTimePicker24({
  id,
  value,
  onChange,
  className = "",
  disabled = false,
  required = false,
}) {
  const normalized = toDateTimeLocalValue(value);
  const [datePart = "", timePart = ""] = normalized.includes("T")
    ? normalized.split("T")
    : ["", ""];
  const [hour = "00", minute = "00"] = timePart ? timePart.split(":") : ["00", "00"];

  const emit = (date, h, m) => {
    if (!date) {
      onChange("");
      return;
    }
    onChange(`${date}T${h}:${m}`);
  };

  return (
    <div
      id={id}
      className={`flex flex-wrap items-center gap-2 ${className}`}
      role="group"
      aria-label="Date and time (24-hour)"
    >
      <input
        type="date"
        value={datePart}
        disabled={disabled}
        required={required && !datePart}
        onChange={(e) => emit(e.target.value, hour, minute)}
        className={`${inputClass} min-w-[9rem]`}
      />
      <div className="flex items-center gap-1">
        <TimeSelect
          value={hour}
          options={HOURS_24}
          disabled={disabled || !datePart}
          ariaLabel="Hour (24-hour)"
          onChange={(h) => emit(datePart, h, minute)}
        />
        <span className="text-white text-sm font-medium">:</span>
        <TimeSelect
          value={minute}
          options={MINUTES_60}
          disabled={disabled || !datePart}
          ariaLabel="Minute"
          onChange={(m) => emit(datePart, hour, m)}
        />
      </div>
    </div>
  );
}
