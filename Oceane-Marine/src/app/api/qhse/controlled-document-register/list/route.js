import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import ControlledDocumentRegister from "@/lib/mongodb/models/qhse-controlled-document/ControlledDocumentRegister";

export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");

    const all = await ControlledDocumentRegister.find()
      .select("year")
      .lean();
    const years = [
      ...new Set(
        all
          .map((i) => i.year)
          .filter((y) => typeof y === "number" && !Number.isNaN(y))
      ),
    ].sort((a, b) => b - a);

    let items;
    if (year) {
      const yr = Number.parseInt(year, 10);
      items = await ControlledDocumentRegister.find({ year: yr })
        .sort({ rowOrder: 1 })
        .lean();
    } else {
      const currentYear = new Date().getFullYear();
      items = await ControlledDocumentRegister.find({
        year: years.length ? years[0] : currentYear,
      })
        .sort({ rowOrder: 1 })
        .lean();
    }

    return NextResponse.json({ success: true, data: items, years });
  } catch (error) {
    console.error("Controlled document register list error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
