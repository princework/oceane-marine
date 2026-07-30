import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { getPmsEquipmentOptions } from "@/lib/pms/equipmentOptions";

/**
 * Equipment pick-list for the STS operation form: PMS primary equipment plus
 * accessories, each tagged with its current condition.
 *
 * RETIRED units are returned rather than filtered out, so the planner can see
 * why a familiar unit can't be picked instead of wondering where it went. The
 * `selectable: false` flag is what the UI disables on, and the create/update
 * routes enforce the same rule server-side.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const { equipment, accessories } = await getPmsEquipmentOptions({
      includeRetired: true,
      withDefects: true,
    });

    return NextResponse.json({ equipment, accessories });
  } catch (error) {
    console.error("STS equipment options error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load equipment options" },
      { status: 500 }
    );
  }
}
