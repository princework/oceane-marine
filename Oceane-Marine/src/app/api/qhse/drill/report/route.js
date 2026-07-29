import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import DrillReport from "@/lib/mongodb/models/qhse-drill/DrillReport";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const getQuarterFromDate = (date) => {
  const d = new Date(date);
  const m = d.getMonth();
  return QUARTERS[Math.floor(m / 3)];
};


export async function POST(req) {
  try {
    await connectDB();
    const body = await req.json();

    const {
      drillNo,
      drillDate,
      location,
      drillScenario,
      participants,
      incidentProgression,
      year,
      quarter,
    } = body;

    // Basic validation
    if (
      !drillNo ||
      !drillDate ||
      !drillScenario ||
      !participants?.length
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate participants
    const validParticipants = participants.filter(
      (p) => p.name?.trim() && p.role?.trim()
    );

    if (validParticipants.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one participant with name and role is required" },
        { status: 400 }
      );
    }

    const resolvedQuarter =
      quarter || (drillDate ? getQuarterFromDate(drillDate) : null);

    const report = await DrillReport.create({
      drillNo: drillNo.trim(),
      drillDate: new Date(drillDate),
      location: location?.trim() || "",
      drillScenario: drillScenario.trim(),
      participants: validParticipants,
      incidentProgression: incidentProgression?.trim() || "",
      year: year ? Number.parseInt(year, 10) : new Date(drillDate).getFullYear(),
      quarter: resolvedQuarter,
      status: "Draft",
    });

    return NextResponse.json({ success: true, data: report }, { status: 201 });
  } catch (error) {
    console.error("Create Drill Report Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}