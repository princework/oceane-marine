import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { getPmsEquipmentOptions } from "@/lib/pms/equipmentOptions";

/**
 * Equipment + location options for the QHSE defects form, sourced from PMS.
 *
 * Reads the PMS collections directly instead of proxying the three PMS list
 * routes: one round trip rather than three on form open, and a QHSE form no
 * longer depends on the caller's `pmsRole`. This grants nothing new — the PMS
 * role fallback is `viewer`, which already carries `canView` for every signed-in
 * user (see `getPmsPermissions`).
 *
 * RETIRED primary equipment is excluded — a unit that's out of service can't
 * carry a live defect. INACTIVE units are kept, and flagged in the label, since
 * a defect is often the reason a unit went inactive.
 */

/** Surface a non-ACTIVE status in the option text; the plain label omits it. */
function withStatusSuffix(option) {
  if (!option.status || option.status === "ACTIVE") return option;
  return { ...option, label: `${option.label} (${option.status})` };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const { equipment, accessories, locations } = await getPmsEquipmentOptions({
      includeRetired: false,
      withLocations: true,
    });

    return NextResponse.json({
      equipment: equipment.map(withStatusSuffix),
      accessories: accessories.map(withStatusSuffix),
      locations,
    });
  } catch (error) {
    console.error("Defect equipment options error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load equipment options" },
      { status: 500 }
    );
  }
}
