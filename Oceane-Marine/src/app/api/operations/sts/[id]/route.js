import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
// Import models to ensure they're registered before populate
import "@/lib/mongodb/models/Location";
import "@/lib/mongodb/models/MooringMaster";
import "@/lib/mongodb/models/CargoType";
import "@/lib/mongodb/models/pms/Equipment";

export async function GET(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const operation = await StsOperation.findById(id)
      .populate("location", "name")
      .populate("mooringMaster", "name")
      .populate("typeOfCargo", "type")
      .populate("equipments.equipment")
      .lean();

    if (!operation) {
      return NextResponse.json(
        { success: false, error: "Operation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: operation,
    });
  } catch (error) {
    console.error("Error fetching operation:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
