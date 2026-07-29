import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Compatibility from "@/lib/mongodb/models/operations/Compatibility";
import { computeHose, computeFender } from "@/app/operations/sts-operations/new/compatibility/calculations";
import { notifyOperationsEdit } from "@/lib/notifications/operationsNotified";

export async function GET(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const doc = await Compatibility.findById(id).lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      operationRef,
      operationNumber,
      year,
      locationId,
      locationName,
      STBL,
      SS,
      section,
    } = body;

    const existing = await Compatibility.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const update = {
      operationRef: operationRef !== undefined ? (operationRef || null) : existing.operationRef,
      operationNumber: operationNumber != null ? String(operationNumber).trim() : existing.operationNumber,
      year: year != null ? Number(year) : existing.year,
      location: {
        locationId: locationId !== undefined ? locationId : existing.location?.locationId,
        name: locationName !== undefined ? String(locationName) : (existing.location?.name ?? ""),
      },
      STBL: STBL || existing.STBL || {},
      SS: SS || existing.SS || {},
    };

    const existingResults = existing.results || {};
    if (section === "fender") {
      update.results = { ...existingResults, fender: computeFender(update.STBL, update.SS) };
    } else {
      update.results = { ...existingResults, hose: computeHose(update.STBL, update.SS) };
    }

    const doc = await Compatibility.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).lean();

    void notifyOperationsEdit("Compatibility", id);
    return NextResponse.json({
      success: true,
      data: doc,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
