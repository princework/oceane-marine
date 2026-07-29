import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import RiskAssessment from "@/lib/mongodb/models/qhse-risk-assessment/RiskAssessment";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";

export const runtime = "nodejs";

export async function POST(req) {
  await connectDB();
  try {
    const form = await req.formData();
    const locationName = form.get("locationName");
    const assessmentDateRaw = form.get("assessmentDate");
    const version = form.get("version");
    const file = form.get("file");

    if (!locationName) {
      return NextResponse.json({ error: "locationName is required" }, { status: 400 });
    }
    if (!version) {
      return NextResponse.json({ error: "version is required" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const assessmentDate = assessmentDateRaw && String(assessmentDateRaw).trim()
      ? new Date(String(assessmentDateRaw).trim())
      : null;
    if (assessmentDate && Number.isNaN(assessmentDate.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filePath = await saveQhseFile({
      formCode: "QAF-OFD-006",
      location: locationName,
      date: assessmentDate || new Date(),
      title: file.name.replace(/\.[^.]+$/, "") || "Risk-Assessment",
      fileType: "documents",
      fileName: file.name,
      buffer,
    });

    const record = await RiskAssessment.create({
      locationName,
      assessmentDate: assessmentDate || undefined,
      version,
      filePath,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });

    return NextResponse.json({ message: "Saved", data: record }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
