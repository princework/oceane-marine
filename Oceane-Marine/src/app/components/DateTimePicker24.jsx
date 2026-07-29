"use client";

import { HOURS_24, MINUTES_60, toDateTimeLocalValue } from "@/lib/datetime24";

const inputClass =
  "w-full rounded-md border border-gray-600 bg-gray-700/50 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-400";

/**
 * Date + time picker using 24-hour clock (00–23).
 * Value/onChange: `YYYY-MM-DDTHH:mm`.
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
        className={`${inputClass} min-w-[10rem] flex-1`}
      />
      <div className="flex items-center gap-1 shrink-0">
        <select
          value={hour}
          disabled={disabled || !datePart}
          aria-label="Hour (24-hour)"
          onChange={(e) => emit(datePart, e.target.value, minute)}
          className={`${inputClass} w-[4.5rem]`}
        >
          {HOURS_24.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="text-white text-sm font-medium">:</span>
        <select
          value={minute}
          disabled={disabled || !datePart}
          aria-label="Minute"
          onChange={(e) => emit(datePart, hour, e.target.value)}
          className={`${inputClass} w-[4.5rem]`}
        >
          {MINUTES_60.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
