import Equipment from "@/lib/mongodb/models/pms/Equipment";
import Accessories from "@/lib/mongodb/models/pms/Accessories";
import PmsLocation from "@/lib/mongodb/models/pms/PmsLocation";
import EquipmentDefect from "@/lib/mongodb/models/qhse-defect/EquipmentDefect";

/**
 * PMS equipment pick-lists, shared by the QHSE defect form and the Operations
 * STS form so the two can't drift apart.
 *
 * Primary equipment and accessories live in separate collections, so every
 * option carries a `source` naming which one it came from — an id alone can't
 * be resolved back.
 */

export const EQUIPMENT_SOURCES = {
  PRIMARY: "Equipment",
  ACCESSORY: "Accessories",
};

/** Defect statuses that mean "faulty right now". Closed defects don't flag a unit. */
export const OPEN_DEFECT_STATUSES = ["Open", "In Progress"];

/** Map key — id alone would collide in theory, and hides which collection to read. */
export function optionKey(source, id) {
  return `${source}:${id}`;
}

/** `A · B · C` from the parts that are actually present */
function joinParts(parts) {
  return parts.filter(Boolean).join(" · ");
}

/**
 * `key -> open defect count` for every unit with an unresolved defect.
 *
 * Only defects carrying an `equipmentId` can be counted. Defects logged before
 * the equipment link existed hold free-text descriptions with no reference to a
 * PMS record, so they can't be attributed to a unit.
 */
export async function getOpenDefectCounts() {
  const defects = await EquipmentDefect.find({
    status: { $in: OPEN_DEFECT_STATUSES },
    isArchived: { $ne: true },
    equipmentId: { $nin: [null, undefined] },
  })
    .select("equipmentId equipmentSource")
    .lean();

  const counts = new Map();
  for (const defect of defects) {
    const source = defect.equipmentSource || EQUIPMENT_SOURCES.PRIMARY;
    const key = optionKey(source, defect.equipmentId);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

/**
 * @param {object}  [opts]
 * @param {boolean} [opts.includeRetired] keep RETIRED primary equipment in the list
 * @param {boolean} [opts.withDefects]    attach `defectCount` / `tags` / `selectable`
 * @param {boolean} [opts.withLocations]  also return the PMS location master
 */
export async function getPmsEquipmentOptions({
  includeRetired = false,
  withDefects = false,
  withLocations = false,
} = {}) {
  const equipmentQuery = includeRetired ? {} : { status: { $ne: "RETIRED" } };

  const [equipment, accessories, locations, defectCounts] = await Promise.all([
    Equipment.find(equipmentQuery)
      .select("equipmentCode serialCode equipmentName equipmentType status locationName isInUse")
      .sort({ equipmentName: 1 })
      .lean(),
    Accessories.find({ isDeleted: { $ne: true } })
      .select("equipmentNo equipmentName category status locationName isInUse")
      .sort({ equipmentName: 1 })
      .lean(),
    withLocations
      ? PmsLocation.find().select("name").sort({ name: 1 }).lean()
      : Promise.resolve([]),
    withDefects ? getOpenDefectCounts() : Promise.resolve(new Map()),
  ]);

  /** Tags are advisory on their own; `selectable` is what callers enforce. */
  const decorate = (option) => {
    if (!withDefects) return option;
    const defectCount = defectCounts.get(optionKey(option.source, option.id)) || 0;
    const retired = option.status === "RETIRED";
    const inUse = Boolean(option.isInUse);
    const tags = [];
    if (defectCount > 0) tags.push("DEFECTED");
    if (retired) tags.push("RETIRED");
    if (inUse) tags.push("IN_USE");
    return {
      ...option,
      defectCount,
      retired,
      inUse,
      tags,
      selectable: defectCount === 0 && !retired && !inUse,
    };
  };

  return {
    equipment: equipment.map((item) =>
      decorate({
        id: String(item._id),
        source: EQUIPMENT_SOURCES.PRIMARY,
        code: item.equipmentCode || "",
        serialCode: item.serialCode || "",
        name: item.equipmentName || "",
        type: item.equipmentType || "",
        status: item.status || "",
        locationName: item.locationName || "",
        isInUse: Boolean(item.isInUse),
        label: joinParts([item.equipmentCode, item.equipmentName, item.serialCode]),
      })
    ),
    accessories: accessories.map((item) =>
      decorate({
        id: String(item._id),
        source: EQUIPMENT_SOURCES.ACCESSORY,
        code: item.equipmentNo || "",
        serialCode: "",
        name: item.equipmentName || "",
        type: item.category || "",
        status: item.status || "",
        locationName: item.locationName || "",
        isInUse: Boolean(item.isInUse),
        label: joinParts([item.equipmentNo, item.equipmentName]),
      })
    ),
    locations: locations.map((loc) => ({ _id: String(loc._id), name: loc.name })),
  };
}

/**
 * Resolves raw ids (as posted by the STS form) into `{ id, source, name }`.
 * Ids arrive without a source, so both collections are checked.
 *
 * @returns {Promise<{ resolved: Map<string, object>, missing: string[] }>}
 */
export async function resolveEquipmentIds(ids) {
  const unique = [...new Set(ids.map(String))];
  if (unique.length === 0) return { resolved: new Map(), missing: [] };

  const [equipment, accessories] = await Promise.all([
    Equipment.find({ _id: { $in: unique } })
      .select("equipmentCode serialCode equipmentName status isInUse")
      .lean(),
    Accessories.find({ _id: { $in: unique }, isDeleted: { $ne: true } })
      .select("equipmentNo equipmentName status isInUse")
      .lean(),
  ]);

  const resolved = new Map();
  for (const item of equipment) {
    resolved.set(String(item._id), {
      id: String(item._id),
      source: EQUIPMENT_SOURCES.PRIMARY,
      name: item.equipmentName || "",
      label: joinParts([item.equipmentCode, item.equipmentName, item.serialCode]),
      status: item.status || "",
      isInUse: Boolean(item.isInUse),
    });
  }
  for (const item of accessories) {
    resolved.set(String(item._id), {
      id: String(item._id),
      source: EQUIPMENT_SOURCES.ACCESSORY,
      name: item.equipmentName || "",
      label: joinParts([item.equipmentNo, item.equipmentName]),
      status: item.status || "",
      isInUse: Boolean(item.isInUse),
    });
  }

  return {
    resolved,
    missing: unique.filter((id) => !resolved.has(id)),
  };
}
