import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Location from "@/lib/mongodb/models/Location";

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData = {};

    if (body.name != null && body.name !== "") {
      updateData.name = body.name;
    }

    // Handle latitude
    if (body.latitude != null && body.latitude !== "") {
      updateData.latitude = Number(body.latitude);
    } else if (body.latitude === null || body.latitude === "") {
      updateData.latitude = null;
    }

    // Handle longitude
    if (body.longitude != null && body.longitude !== "") {
      updateData.longitude = Number(body.longitude);
    } else if (body.longitude === null || body.longitude === "") {
      updateData.longitude = null;
    }

    const updated = await Location.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true, strict: false }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Location updated successfully",
      data: updated,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
