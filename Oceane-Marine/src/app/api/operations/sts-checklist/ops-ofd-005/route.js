import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist5 from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005";
import { incrementRevisionForUpdate } from "../revision.js";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-005.job.js";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";
import { buildOperationsStsSignatureDirs } from "@/lib/utils/signature-storage";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const operationRef = searchParams.get("operationRef");

    if (!operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const checklist = await STSChecklist5.findOne({ operationRef }).lean();

    if (!checklist) {
      return NextResponse.json(
        { error: "Checklist not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, data: checklist },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("GET Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function PUT(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const operationRef = searchParams.get("operationRef");

    if (!operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const existing = await STSChecklist5.findOne({ operationRef }).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Checklist not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const formData = await req.formData();
    const dataStr = formData.get("data");

    if (!dataStr) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const body = JSON.parse(dataStr);

    const signatureFile = formData.get("signature");
    let signatureUrl = body.signature?.signature || existing.signature?.signature;

    if (signatureFile && typeof signatureFile !== "string" && signatureFile.name) {
      const bytes = await signatureFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-005").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-${signatureFile.name}`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-005").urlDir}/${fileName}`;
    }

    const revisionNo = incrementRevisionForUpdate(existing.documentInfo?.revisionNo);

    const updateData = {
      documentInfo: {
        ...(body.documentInfo || existing.documentInfo || {}),
        revisionNo,
        issueDate: body.documentInfo?.issueDate
          ? new Date(body.documentInfo.issueDate)
          : (existing.documentInfo?.issueDate || new Date()),
      },
      transferInfo: body.transferInfo || existing.transferInfo || {},
      checklist5A: body.checklist5A || existing.checklist5A || [],
      checklist5BShip: {
        noteIntervalHours: body.checklist5BShip?.noteIntervalHours ?? existing.checklist5BShip?.noteIntervalHours ?? 0,
        entityName: body.checklist5BShip?.entityName ?? existing.checklist5BShip?.entityName ?? "",
        rows: body.checklist5BShip?.rows || existing.checklist5BShip?.rows || [],
        initials: Array.isArray(body.checklist5BShip?.initials) 
          ? body.checklist5BShip.initials 
          : (Array.isArray(existing.checklist5BShip?.initials) ? existing.checklist5BShip.initials : [])
      },
      checklist5CTerminal: {
        noteIntervalHours: body.checklist5CTerminal?.noteIntervalHours ?? existing.checklist5CTerminal?.noteIntervalHours ?? 0,
        entityName: body.checklist5CTerminal?.entityName ?? existing.checklist5CTerminal?.entityName ?? "",
        rows: body.checklist5CTerminal?.rows || existing.checklist5CTerminal?.rows || [],
        initials: Array.isArray(body.checklist5CTerminal?.initials) 
          ? body.checklist5CTerminal.initials 
          : (Array.isArray(existing.checklist5CTerminal?.initials) ? existing.checklist5CTerminal.initials : [])
      },
      signature: {
        name: body.signature?.name || existing.signature?.name || "",
        rank: body.signature?.rank || existing.signature?.rank || "",
        signature: signatureUrl || "",
        date: body.signature?.date
          ? new Date(body.signature.date)
          : existing.signature?.date,
      },
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedChecklist = await STSChecklist5.findOneAndUpdate(
      { operationRef },
      updateData,
      { new: true, runValidators: true }
    );

    await createAndScheduleJob(null, "generate-ops-ofd-005", {
      checklistId: updatedChecklist._id.toString(),
      operationRef: updatedChecklist.operationRef,
    });

    void notifyOperationsEdit("OPS-OFD-005", updatedChecklist._id);
    return NextResponse.json(
      {
        success: true,
        message: "Checklist updated successfully & doc regeneration started",
        data: updatedChecklist,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("PUT Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
