import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import PoacCrossCompetency from "@/lib/mongodb/models/qhse-poac/PoacCrossCompetency";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;

    const form = await PoacCrossCompetency.findById(id);

    if (!form) {
      return NextResponse.json(
        { success: false, error: "Form not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: form,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POAC GET ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch form",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const form = await PoacCrossCompetency.findById(id);
    if (!form) {
      return NextResponse.json(
        { success: false, error: "Form not found" },
        { status: 404 }
      );
    }
    await PoacCrossCompetency.findByIdAndDelete(id);
    void notifyDelete("QHSE", "cross-competency", id);
    return NextResponse.json(
      { success: true, message: "Record deleted" },
      { status: 200 }
    );
  } catch (error) {
    console.error("POAC DELETE ERROR:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete form" },
      { status: 500 }
    );
  }
}