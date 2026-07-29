import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MOCManagementChange from "@/lib/mongodb/models/qhse-moc/mocs-managementChange";

// GET -> fetch single MOC Management Change record by id
export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;

    const moc = await MOCManagementChange.findById(id);

    if (!moc) {
      return NextResponse.json(
        { success: false, error: "MOC Management of Change not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: moc }, { status: 200 });
  } catch (error) {
    console.error("MOC status fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch MOC Management of Change" },
      { status: 500 }
    );
  }
}


