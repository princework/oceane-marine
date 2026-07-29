import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { connectDB } from "@/lib/config/connection";
import Location from "@/lib/mongodb/models/Location";

export async function POST(req) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.operationsRole !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin role required" },
        { status: 403 }
      );
    }
    await connectDB();
    const { name, latitude, longitude } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const existingLocation = await Location.findOne({ name });
    if (existingLocation) {
      return NextResponse.json(
        { error: "Location already exists" },
        { status: 400 }
      );
    }

    const locationData = { name };
    if (latitude != null && latitude !== "") locationData.latitude = Number(latitude);
    if (longitude != null && longitude !== "") locationData.longitude = Number(longitude);

    const newLocation = new Location(locationData);
    await newLocation.save();
    return NextResponse.json(
      { message: "Location created successfully", data: newLocation },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
