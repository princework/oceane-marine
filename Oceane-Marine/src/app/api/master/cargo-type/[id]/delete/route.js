import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import CargoType from "@/lib/mongodb/models/CargoType";

export async function DELETE(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const deleted = await CargoType.findById(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Cargo type not found" },
        { status: 404 }
      );
    }
    await CargoType.findByIdAndDelete(id);
    return NextResponse.json(
      { message: "Cargo type deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
