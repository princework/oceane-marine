import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TargetKpi from "@/lib/mongodb/models/qhse-kpi/TargetKpi";
import { getNextRevisionNumber } from "@/lib/utils/qhse-revision";

/**
 * POST /api/qhse/kpi/target/create
 *
 * Tracker-style upsert: each year owns a single live Target KPI document. If
 * one already exists for the requested year, this endpoint UPDATES that
 * record (the form re-submits all rows, so previously-saved entries are
 * preserved and brand-new entries are appended automatically). If no record
 * exists for the year yet, a brand new one is created with a fresh
 * year-wise serial number.
 */
export async function POST(req) {
  await connectDB();

  try {
    const body = await req.json();
    const { year, rows } = body;

    const yearNum = year != null ? Number(year) : new Date().getFullYear();
    if (Number.isNaN(yearNum)) {
      return NextResponse.json(
        { success: false, error: "Valid year is required" },
        { status: 400 }
      );
    }

    const normalizedRows = Array.isArray(rows)
      ? rows.map((r) => ({
          title: r.title || "",
          targetForYear: Number(r.targetForYear) || 0,
          quarter1: Number(r.quarter1) || 0,
          quarter2: Number(r.quarter2) || 0,
          quarter3: Number(r.quarter3) || 0,
          quarter4: Number(r.quarter4) || 0,
          targetsAchieved: Number(r.targetsAchieved) || 0,
        }))
      : [];

    const existing = await TargetKpi.findOne({
      year: yearNum,
      isArchived: { $ne: true },
    }).sort({ updatedAt: -1, createdAt: -1 });

    if (existing) {
      existing.rows = normalizedRows;
      // Bump the audit-trail revision on every tracker save so the list/PDF
      // reflects each appended batch of entries.
      existing.revNo = getNextRevisionNumber(existing.revNo);
      await existing.save();
      return NextResponse.json(
        {
          success: true,
          message: "Target KPI tracker updated",
          mode: "updated",
          data: existing,
        },
        { status: 200 }
      );
    }

    const record = await TargetKpi.create({
      year: yearNum,
      rows: normalizedRows,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Target KPI tracker created",
        mode: "created",
        data: record,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Target KPI create error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create Target KPI",
      },
      { status: 500 }
    );
  }
}
