"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Shared PMS-sourced Equipment + Base fields for the defect create / plan forms.
 *
 * Both pages carry the identical field set, so the options fetch, the grouped
 * dropdown and the location auto-fill live here rather than being copied twice.
 */

const SELECT_CLASS =
  "w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400/60 disabled:opacity-60";

const LABEL_CLASS =
  "block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5";

/** Stable `<select>` value for an option — id alone can't say which collection it came from. */
export function equipmentKeyOf(source, id) {
  if (!source || !id) return "";
  return `${source}:${id}`;
}

export const EMPTY_EQUIPMENT_SNAPSHOT = {
  equipmentId: null,
  equipmentSource: null,
  equipmentCode: "",
  equipmentSerialCode: "",
  equipmentName: "",
};

/** Fields persisted on the defect for the chosen PMS unit. */
export function buildEquipmentSnapshot(option) {
  if (!option) return { ...EMPTY_EQUIPMENT_SNAPSHOT };
  return {
    equipmentId: option.id,
    equipmentSource: option.source,
    equipmentCode: option.code || "",
    equipmentSerialCode: option.serialCode || "",
    equipmentName: option.name || "",
  };
}

/** Label for a defect whose PMS record is gone, or is retired and no longer listed. */
export function storedEquipmentLabel(defect) {
  if (!defect) return "";
  const parts = [
    defect.equipmentCode,
    defect.equipmentName,
    defect.equipmentSerialCode,
  ].filter(Boolean);
  return parts.join(" · ");
}

/**
 * Loads PMS equipment + locations for the defect form.
 *
 * `loadError` is surfaced rather than swallowed — an empty dropdown with no
 * explanation reads as "there is no equipment", which is a different problem
 * from "the lookup failed".
 */
export function useDefectEquipmentOptions() {
  const [equipment, setEquipment] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    // `loading` already starts true — setting it here would be a synchronous
    // setState in an effect body, and this only ever runs once on mount.
    let cancelled = false;

    fetch("/api/qhse/defects-list/equipment-options")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data.error ||
              (res.status === 401
                ? "Your session has expired. Sign in again to load the equipment list."
                : "Could not load the PMS equipment list.")
          );
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setEquipment(Array.isArray(data.equipment) ? data.equipment : []);
        setAccessories(Array.isArray(data.accessories) ? data.accessories : []);
        setLocations(Array.isArray(data.locations) ? data.locations : []);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.message || "Could not load the PMS equipment list.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const optionsByKey = useMemo(() => {
    const map = new Map();
    for (const option of [...equipment, ...accessories]) {
      map.set(equipmentKeyOf(option.source, option.id), option);
    }
    return map;
  }, [equipment, accessories]);

  return { equipment, accessories, locations, optionsByKey, loading, loadError };
}

/**
 * Equipment picker, grouped by PMS inventory type.
 *
 * `fallbackLabel` keeps an edit form honest when the saved unit is no longer in
 * the list (deleted in PMS, or since retired) — without it the select would
 * silently render as "Select equipment" and a save would wipe the link.
 */
export function EquipmentSelect({
  value,
  onChange,
  equipment,
  accessories,
  loading,
  fallbackLabel,
  disabled,
  required = true,
  id = "equipmentId",
}) {
  const isMissingFromList = Boolean(value) && !!fallbackLabel;

  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        Equipment <span className="text-slate-400">(from PMS)</span>
      </label>
      <select
        id={id}
        className={SELECT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled || loading}
      >
        <option value="">
          {loading ? "Loading equipment…" : "Select equipment"}
        </option>

        {isMissingFromList && (
          <option value={value}>{fallbackLabel} — no longer in PMS list</option>
        )}

        {equipment.length > 0 && (
          <optgroup label="Primary Equipment">
            {equipment.map((item) => (
              <option
                key={equipmentKeyOf(item.source, item.id)}
                value={equipmentKeyOf(item.source, item.id)}
              >
                {item.label}
              </option>
            ))}
          </optgroup>
        )}

        {accessories.length > 0 && (
          <optgroup label="Accessories">
            {accessories.map((item) => (
              <option
                key={equipmentKeyOf(item.source, item.id)}
                value={equipmentKeyOf(item.source, item.id)}
              >
                {item.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {!loading && equipment.length === 0 && accessories.length === 0 && (
        <p className="mt-1 text-[11px] text-amber-200">
          No equipment found in PMS. Add equipment under PMS → Equipment
          Inventory first.
        </p>
      )}
    </div>
  );
}

/**
 * Base / location picker fed by the PMS Location master.
 *
 * Auto-filled from the selected equipment but left editable — gear gets moved,
 * and the defect belongs where the unit actually is.
 */
export function BaseSelect({
  value,
  onChange,
  locations,
  loading,
  disabled,
  autoFilled,
  required = true,
  id = "base",
}) {
  const isUnlisted = Boolean(value) && !locations.some((l) => l.name === value);

  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        Base / Location <span className="text-slate-400">(from PMS)</span>
      </label>
      <select
        id={id}
        className={SELECT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled || loading}
      >
        <option value="">
          {loading ? "Loading locations…" : "Select base / location"}
        </option>
        {/* Keeps legacy values (saved from the old master-Location list) and
            equipment locations that aren't in the PMS master from being lost. */}
        {isUnlisted && <option value={value}>{value}</option>}
        {locations.map((loc) => (
          <option key={loc._id} value={loc.name}>
            {loc.name}
          </option>
        ))}
      </select>
      {autoFilled && (
        <p className="mt-1 text-[11px] text-sky-300">
          Filled from the selected equipment&apos;s PMS location — change it if
          the unit has been moved.
        </p>
      )}
    </div>
  );
}
