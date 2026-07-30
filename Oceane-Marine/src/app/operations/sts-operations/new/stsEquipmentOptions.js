"use client";

/**
 * Shared pieces for the STS "Equipment Used" dropdown.
 *
 * The create and edit pages each keep their own copy of `MultiSelectDropdown`,
 * so the option shaping, grouping and row rendering live here to stop the two
 * drifting apart.
 */

export const EQUIPMENT_GROUPS = {
  Equipment: "Primary Equipment",
  Accessories: "Accessories",
};

const GROUP_ORDER = [EQUIPMENT_GROUPS.Equipment, EQUIPMENT_GROUPS.Accessories];

/** Maps the `/api/operations/sts/equipment-options` response to dropdown options. */
export function buildStsEquipmentOptions(json) {
  const equipment = Array.isArray(json?.equipment) ? json.equipment : [];
  const accessories = Array.isArray(json?.accessories) ? json.accessories : [];

  return [...equipment, ...accessories].map((item) => ({
    value: item.id,
    label: item.label || item.name || "Equipment",
    group: EQUIPMENT_GROUPS[item.source] || EQUIPMENT_GROUPS.Equipment,
    source: item.source,
    tags: Array.isArray(item.tags) ? item.tags : [],
    defectCount: item.defectCount || 0,
    // Defected and retired units stay visible but can't be committed to an
    // operation; the create route enforces the same rule server-side.
    selectable: item.selectable !== false,
  }));
}

/** `[{ group, items }]` in a fixed order, skipping groups with nothing in them. */
export function groupEquipmentOptions(options = []) {
  const buckets = new Map();
  for (const option of options) {
    const group = option.group || EQUIPMENT_GROUPS.Equipment;
    if (!buckets.has(group)) buckets.set(group, []);
    buckets.get(group).push(option);
  }

  const ordered = GROUP_ORDER.filter((group) => buckets.get(group)?.length).map(
    (group) => ({ group, items: buckets.get(group) })
  );

  // Anything with an unrecognised group still renders rather than vanishing.
  for (const [group, items] of buckets) {
    if (!GROUP_ORDER.includes(group)) ordered.push({ group, items });
  }
  return ordered;
}

/** Defect is the blocking fault; retired is a lifecycle state. */
function tagClassName(tag) {
  if (tag === "DEFECTED") {
    return "border-rose-400/40 bg-rose-500/20 text-rose-200";
  }
  if (tag === "RETIRED") {
    return "border-slate-400/30 bg-slate-500/25 text-slate-300";
  }
  return "border-white/20 bg-white/10 text-white/70";
}

/** "DEFECTED ×2" once a unit has more than one open defect. */
function tagLabel(tag, option) {
  if (tag === "DEFECTED" && option?.defectCount > 1) {
    return `DEFECTED ×${option.defectCount}`;
  }
  return tag;
}

/**
 * One row of the equipment dropdown.
 *
 * A blocked unit that's somehow already selected (a restored draft, or a defect
 * logged after the draft was saved) stays unlockable — only *checking* it is
 * prevented, so the user can always clear it.
 */
export function EquipmentOptionRow({ option, checked, onToggle }) {
  const blocked = !option.selectable;
  const disabled = blocked && !checked;

  return (
    <label
      className={`flex items-center gap-3 px-4 py-2 text-sm ${
        disabled
          ? "cursor-not-allowed text-white/40"
          : "cursor-pointer text-white hover:bg-white/10"
      }`}
      title={
        blocked
          ? option.tags.includes("DEFECTED")
            ? "This equipment has an open defect and cannot be used"
            : "This equipment is retired and cannot be used"
          : undefined
      }
    >
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-white/50 bg-transparent text-orange-400 focus:ring-orange-400 disabled:opacity-40"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
      />
      <span className={`min-w-0 flex-1 truncate ${blocked ? "line-through" : ""}`}>
        {option.label}
      </span>
      {option.tags.map((tag) => (
        <span
          key={tag}
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tagClassName(tag)}`}
        >
          {tagLabel(tag, option)}
        </span>
      ))}
    </label>
  );
}
