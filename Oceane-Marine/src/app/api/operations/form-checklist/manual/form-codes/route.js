import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import ManualFormCode from "@/lib/mongodb/models/operations-form-checklist/ManualFormCode";
import { getSessionUser } from "@/lib/auth/getSessionUser";

const DEFAULT_CODES = [
  { code: "BCP-OFD-03", name: "Business Continuity Plan- Manual" },
  { code: "MYM-OFD-04", name: "Maintenance and Yards Operations Manual" },
  { code: "OPM-OFD-01", name: "Operations Procedure Manual" },
  { code: "QHSE-OFD-02", name: "QHSE Management System Manual" },
];

async function ensureSeeded() {
  const count = await ManualFormCode.countDocuments();
  if (count === 0) {
    await ManualFormCode.insertMany(DEFAULT_CODES);
  }
}

export async function GET() {
  await connectDB();
  try {
    await ensureSeeded();
    const codes = await ManualFormCode.find().sort({ code: 1 }).lean();
    return NextResponse.json({ success: true, data: codes });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.operationsRole !== "admin") {
    return NextResponse.json(
      { success: false, error: "Forbidden: Operations admin required" },
      { status: 403 }
    );
  }

  await connectDB();
  try {
    const body = await req.json();
    const { code, name } = body;

    if (!code?.trim()) {
      return NextResponse.json(
        { success: false, error: "Form code is required" },
        { status: 400 }
      );
    }
    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    const existing = await ManualFormCode.findOne({ code: code.trim() });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Form code "${code.trim()}" already exists` },
        { status: 409 }
      );
    }

    const record = await ManualFormCode.create({
      code: code.trim(),
      name: name.trim(),
    });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, error: "Form code already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
