import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MooringMaster from "@/lib/mongodb/models/MooringMaster";

export async function DELETE(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;

    // 1. Check if the record exists
    const existing = await MooringMaster.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Mooring master not found" },
        { status: 404 }
      );
    }

    // 2. Delete the record
    await MooringMaster.findByIdAndDelete(id);

    // 3. Respond
    return NextResponse.json(
      { message: "Mooring master deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete" },
      { status: 500 }
    );
  }
}
