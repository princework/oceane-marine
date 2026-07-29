import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TargetKpi from "@/lib/mongodb/models/qhse-kpi/TargetKpi";
import mongoose from "mongoose";
import { getNextRevisionNumber } from "@/lib/utils/qhse-revision";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    const doc = await TargetKpi.findById(id).lean();
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Target KPI not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error("Target KPI get error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { year, rows } = body;

    const doc = await TargetKpi.findById(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Target KPI not found" },
        { status: 404 }
      );
    }

    if (year != null) {
      const yearNum = Number(year);
      if (!Number.isNaN(yearNum)) doc.year = yearNum;
    }

    if (Array.isArray(rows)) {
      doc.rows = rows.map((r) => ({
        title: r.title || "",
        targetForYear: Number(r.targetForYear) || 0,
        quarter1: Number(r.quarter1) || 0,
        quarter2: Number(r.quarter2) || 0,
        quarter3: Number(r.quarter3) || 0,
        quarter4: Number(r.quarter4) || 0,
        targetsAchieved: Number(r.targetsAchieved) || 0,
      }));
    }

    doc.revNo = getNextRevisionNumber(doc.revNo);
    await doc.save();

    void notifyEdit("QHSE", "kpi · target · update", id);
    return NextResponse.json({
      success: true,
      message: "Target KPI updated",
      data: doc,
    });
  } catch (error) {
    console.error("Target KPI update error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    const doc = await TargetKpi.findByIdAndDelete(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Target KPI not found" },
        { status: 404 }
      );
    }

    void notifyDelete("QHSE", "kpi · target", id);
    return NextResponse.json({
      success: true,
      message: "Target KPI deleted successfully",
    });
  } catch (error) {
    console.error("Target KPI delete error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
