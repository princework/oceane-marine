import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Location from "@/lib/mongodb/models/Location";

export async function DELETE(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const deleted = await Location.findById(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }
    await Location.findByIdAndDelete(id);

    return NextResponse.json(
      { message: "Location deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
