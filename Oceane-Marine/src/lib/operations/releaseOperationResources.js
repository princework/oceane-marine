import Equipment from "@/lib/mongodb/models/pms/Equipment";
import Accessories from "@/lib/mongodb/models/pms/Accessories";
import MooringMaster from "@/lib/mongodb/models/MooringMaster";

/**
 * Releases the primary equipment, accessories, and mooring master locked to
 * an operation back to the pool when the operation completes.
 *
 * Both primary equipment and accessories carry their own `isInUse` lock, set
 * by create/route.js — released here the same way. (Accessories also have a
 * separate `putInUse` field, but that's condition/service status, not an
 * operation-booking flag — never touched here.)
 *
 * @param {{equipments?: Array, mooringMaster?: string|import("mongoose").Types.ObjectId}} operation
 * @returns {Promise<Array>} the equipments array with in-use entries marked RELEASED
 */
export async function releaseOperationResources({ equipments = [], mooringMaster } = {}) {
  const now = new Date();
  const releasedEquipments = [];

  for (const eq of equipments) {
    const plain = eq?.toObject ? eq.toObject() : { ...eq };
    if (plain.status === "IN_USE") {
      const hours = (now.getTime() - new Date(plain.startTime).getTime()) / 36e5;
      if ((plain.equipmentSource || "Equipment") === "Equipment") {
        await Equipment.findByIdAndUpdate(plain.equipment, {
          isInUse: false,
          lastUsedAt: now,
        });
      } else if (plain.equipmentSource === "Accessories") {
        await Accessories.findByIdAndUpdate(plain.equipment, {
          isInUse: false,
        });
      }
      plain.usedHours = hours;
      plain.endTime = now;
      plain.status = "RELEASED";
    }
    releasedEquipments.push(plain);
  }

  if (mooringMaster) {
    await MooringMaster.findByIdAndUpdate(mooringMaster, {
      availabilityStatus: "AVAILABLE",
      currentOperation: null,
    });
  }

  return releasedEquipments;
}
