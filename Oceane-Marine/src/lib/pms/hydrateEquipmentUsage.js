import Accessories from "@/lib/mongodb/models/pms/Accessories";
import { EQUIPMENT_SOURCES } from "@/lib/pms/equipmentOptions";

/**
 * Fills in the `equipment` object for accessory usage entries.
 *
 * `equipments.equipment` is declared `ref: "Equipment"`, so `.populate()` leaves
 * accessory entries as a bare ObjectId. Call this after populating to give every
 * entry the same shape, so readers don't need to know which collection the unit
 * came from.
 *
 * Expects a lean operation document; mutates nothing and returns a new object.
 */
export async function hydrateEquipmentUsage(operation) {
  if (!operation?.equipments?.length) return operation;

  const accessoryIds = operation.equipments
    .filter((entry) => entry?.equipmentSource === EQUIPMENT_SOURCES.ACCESSORY)
    .map((entry) => entry.equipment)
    .filter(Boolean);

  if (accessoryIds.length === 0) return operation;

  const accessories = await Accessories.find({ _id: { $in: accessoryIds } })
    .select("equipmentNo equipmentName category status locationName")
    .lean();

  const byId = new Map(accessories.map((item) => [String(item._id), item]));

  return {
    ...operation,
    equipments: operation.equipments.map((entry) => {
      if (entry?.equipmentSource !== EQUIPMENT_SOURCES.ACCESSORY) return entry;

      const accessory = byId.get(String(entry.equipment));
      if (!accessory) {
        // Deleted from PMS — fall back to the name captured at selection time
        // so the operation still reads correctly.
        return {
          ...entry,
          equipment: {
            _id: entry.equipment,
            equipmentName: entry.equipmentName || "Accessory (removed from PMS)",
          },
        };
      }

      return {
        ...entry,
        equipment: {
          _id: String(accessory._id),
          equipmentCode: accessory.equipmentNo || "",
          equipmentName: accessory.equipmentName || entry.equipmentName || "",
          equipmentType: accessory.category || "",
          status: accessory.status || "",
          locationName: accessory.locationName || "",
        },
      };
    }),
  };
}
