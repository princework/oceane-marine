import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { connectDB } from "@/lib/config/connection";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import { HARDCOPY_DOC_PREFIX } from "@/lib/utils/sts-linked-form-file";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

function sanitizeOriginalName(name) {
  const base = (name || "file").replace(/[^\w.\- ()[\]]/g, "_").slice(0, 180);
  return base || "file";
}

export async function POST(req) {
  try {
    const sessionUser = await getSessionUser();
    const role = sessionUser?.operationsRole;
    if (!sessionUser || (role !== "admin" && role !== "editor")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Operations admin or editor required" },
        { status: 403 }
      );
    }

    await connectDB();

    const formData = await req.formData();
    const operationRef = String(formData.get("operationRef") || "").trim();
    const formTarget = String(formData.get("formTarget") || "__GENERAL__").trim();
    const file = formData.get("file");

    if (!operationRef) {
      return NextResponse.json(
        { success: false, error: "operationRef is required" },
        { status: 400 }
      );
    }

    if (!file || typeof file === "string" || !file.size) {
      return NextResponse.json(
        { success: false, error: "A file is required" },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "File too large (max 50 MB)" },
        { status: 400 }
      );
    }

    const operation = await StsOperation.findOne({
      Operation_Ref_No: operationRef,
      isLatest: true,
    }).select("_id documents Operation_Ref_No");

    if (!operation) {
      return NextResponse.json(
        { success: false, error: "No operation found for this reference" },
        { status: 404 }
      );
    }

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");

    const uploadDir = path.join(
      process.cwd(),
      `public/uploads/sts-operations/checklist-hardcopies/${y}/${m}/${d}`
    );
    await fs.mkdir(uploadDir, { recursive: true });

    const safeOriginal = sanitizeOriginalName(file.name);
    const fileName = `${Date.now()}-${crypto.randomUUID()}-${safeOriginal}`;
    const filePath = path.join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(bytes));

    const dbPath = `/uploads/sts-operations/checklist-hardcopies/${y}/${m}/${d}/${fileName}`;
    const documentType = `${HARDCOPY_DOC_PREFIX}${formTarget}`;

    const docEntry = {
      documentType,
      filePath: dbPath,
      source: "CHECKLIST_HARDCOPY",
      status: "GENERATED",
      uploadedAt: new Date(),
      uploadedBy: sessionUser._id,
    };

    await StsOperation.updateOne(
      { _id: operation._id },
      { $push: { documents: docEntry } }
    );

    return NextResponse.json({
      success: true,
      message: "Hardcopy attached to operation",
      data: {
        operationRef,
        documentType,
        filePath: dbPath,
        originalName: safeOriginal,
      },
    });
  } catch (error) {
    console.error("checklist-hardcopy POST:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
