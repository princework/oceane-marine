import { NextResponse } from "next/server";
import Accessories from "@/lib/mongodb/models/pms/Accessories.js";
import { connectDB } from "@/lib/config/connection.js";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";

export async function GET(req) {
  const guard = await assertPmsPermission("canView");
  if (!guard.ok) return guard.response;
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const category = searchParams.get("category"); // REGULAR or OCCASIONAL

    // Build query
    const query = { isDeleted: { $ne: true } };

    // Filter by purchase year if provided
    if (year) {
      const yearNum = parseInt(year);
      const startDate = new Date(yearNum, 0, 1);
      const endDate = new Date(yearNum + 1, 0, 1);
      query.purchaseDate = {
        $gte: startDate,
        $lt: endDate
      };
    }

    // Filter by category if provided
    if (category && (category === "REGULAR" || category === "OCCASIONAL")) {
      query.category = category;
    }

    // Fetch accessories
    const accessories = await Accessories.find(query)
      .sort({ purchaseDate: -1, createdAt: -1 })
      .lean();

    // Get available years from purchase dates of all accessories
    const allAccessories = await Accessories.find({ 
      isDeleted: { $ne: true },
      purchaseDate: { $exists: true, $ne: null }
    })
      .select("purchaseDate")
      .lean();

    const yearsSet = new Set();
    allAccessories.forEach((item) => {
      if (item.purchaseDate) {
        const itemYear = new Date(item.purchaseDate).getFullYear();
        yearsSet.add(itemYear);
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    return NextResponse.json({
      data: accessories,
      years: years.length > 0 ? years : [new Date().getFullYear()],
      total: accessories.length
    });
  } catch (error) {
    console.error("List Accessories Error:", error);
    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
