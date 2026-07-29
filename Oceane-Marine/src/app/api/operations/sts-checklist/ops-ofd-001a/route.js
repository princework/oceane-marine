import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import ShipStandardQuestionnaire from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-001-A";
import { incrementRevisionForUpdate } from "../revision.js";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-001a.job.js";
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

// ================================================================
// GET - Fetch existing questionnaire by operationRef
// ================================================================
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

    const questionnaire = await ShipStandardQuestionnaire.findOne({ operationRef }).lean();

    console.log("[OPS-OFD-001A GET] Found questionnaire:", {
      operationRef,
      hasQuestionnaire: !!questionnaire,
      basicInfo: questionnaire?.basicInfo,
      responsesCount: questionnaire?.responses ? Object.keys(questionnaire.responses).length : 0,
      signaturePresent: !!questionnaire?.signature?.signature,
    });

    if (!questionnaire) {
      return NextResponse.json(
        { error: "Checklist not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, data: questionnaire },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("OPS-OFD-001A GET Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// ================================================================
// PUT - Update existing questionnaire by operationRef
// ================================================================
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

    const existing = await ShipStandardQuestionnaire.findOne({ operationRef }).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Questionnaire not found" },
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

    console.log("[OPS-OFD-001A PUT] Received body keys:", Object.keys(body));
    console.log("[OPS-OFD-001A PUT] body.basicInfo:", body.basicInfo);
    console.log("[OPS-OFD-001A PUT] body.documentInfo:", body.documentInfo);

    // Handle signature
    const signatureFile = formData.get("signature");
    let signatureUrl = body.signature?.signature || existing.signature?.signature;
    let oldSignatureUrl = existing.signature?.signature;

    const deleteOldSignature = async (oldUrl) => {
      if (!oldUrl || oldUrl.startsWith("http://") || oldUrl.startsWith("https://") || oldUrl.startsWith("data:")) {
        return;
      }
      try {
        const oldFilePath = path.join(process.cwd(), "public", oldUrl);
        await fs.unlink(oldFilePath);
        console.log("Old signature deleted:", oldUrl);
      } catch (err) {
        console.log("Could not delete old signature:", err.message);
      }
    };

    if (signatureFile && typeof signatureFile !== "string" && signatureFile.name) {
      await deleteOldSignature(oldSignatureUrl);
      const bytes = await signatureFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-001").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-${signatureFile.name}`;
      const filePath = path.join(uploadDir, fileName);
      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-001").urlDir}/${fileName}`;
    } else if (body.signature?.signature && body.signature.signature.startsWith("data:image")) {
      await deleteOldSignature(oldSignatureUrl);
      const base64Data = body.signature.signature.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-001").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-signature.png`;
      const filePath = path.join(uploadDir, fileName);
      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-001").urlDir}/${fileName}`;
    } else if (body.signature?.signature && !body.signature.signature.startsWith("http") && !body.signature.signature.startsWith("/")) {
      try {
        await deleteOldSignature(oldSignatureUrl);
        const buffer = Buffer.from(body.signature.signature, "base64");

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");

        const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-001").physicalDir);
        await fs.mkdir(uploadDir, { recursive: true });

        const fileName = `${Date.now()}-signature.png`;
        const filePath = path.join(uploadDir, fileName);
        await fs.writeFile(filePath, buffer);
        signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-001").urlDir}/${fileName}`;
      } catch (err) {
        console.error("Failed to process raw base64 signature:", err);
      }
    }

    const revisionNo = incrementRevisionForUpdate(existing.documentInfo?.revisionNo);

    // ✅ Read from body.basicInfo and body.documentInfo (matching frontend payload structure)
    const updateData = {
      documentInfo: {
        formNo: body.documentInfo?.formNo || existing.documentInfo?.formNo || "OPS-OFD-001A",
        revisionNo,
        revisionDate: body.documentInfo?.revisionDate
          ? new Date(body.documentInfo.revisionDate)
          : existing.documentInfo?.revisionDate,
        approvedBy: body.documentInfo?.approvedBy || existing.documentInfo?.approvedBy || "JS",
      },
      basicInfo: {
        proposedLocation: body.basicInfo?.proposedLocation || existing.basicInfo?.proposedLocation || "",
        shipName: body.basicInfo?.shipName || existing.basicInfo?.shipName || "",
        date: body.basicInfo?.date ? new Date(body.basicInfo.date) : existing.basicInfo?.date,
      },
      responses: body.responses || existing.responses || {},
      signature: {
        name: body.signature?.name || existing.signature?.name || "",
        rank: body.signature?.rank || existing.signature?.rank || "",
        signature: signatureUrl || "",
        date: body.signature?.date
          ? new Date(body.signature.date)
          : existing.signature?.date,
      },
      status: body.status || existing.status || "DRAFT",
    };

    console.log("[OPS-OFD-001A PUT] Update data basicInfo:", updateData.basicInfo);
    console.log("[OPS-OFD-001A PUT] Update data documentInfo:", updateData.documentInfo);

    const updatedQuestionnaire = await ShipStandardQuestionnaire.findOneAndUpdate(
      { operationRef },
      updateData,
      { new: true, runValidators: true }
    );

    // Schedule DOCX regeneration job
    await createAndScheduleJob(null, "generate-ops-ofd-001a", {
      checklistId: updatedQuestionnaire._id.toString(),
      operationRef: updatedQuestionnaire.operationRef,
    });

    void notifyOperationsEdit("OPS-OFD-001A", updatedQuestionnaire._id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-001A questionnaire updated successfully & doc regeneration started",
        data: updatedQuestionnaire,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("OPS-OFD-001A PUT Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
