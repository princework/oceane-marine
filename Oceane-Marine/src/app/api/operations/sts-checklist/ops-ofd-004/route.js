import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist4AF from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-004";
import { incrementRevisionForUpdate } from "../revision.js";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-004.job.js";
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

    const checklist = await STSChecklist4AF.findOne({ operationRef }).lean();

    console.log('[OPS-OFD-004 GET] Found checklist:', {
      operationRef,
      hasChecklist: !!checklist,
      checklist4ACount: checklist?.checklist4A?.checks?.length || 0,
      signaturePresent: !!checklist?.signature?.signature,
      transferInfo: checklist?.transferInfo
    });

    if (!checklist) {
      return NextResponse.json(
        { error: "Checklist not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Return data as-is, frontend will handle transformation
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

    const existing = await STSChecklist4AF.findOne({ operationRef }).lean();

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
    let signatureUrl = body.signatureBlock?.signature || body.signature?.signature || existing.signature?.signature;
    let oldSignatureUrl = existing.signature?.signature;

    // Helper function to delete old signature file
    const deleteOldSignature = async (oldUrl) => {
      if (!oldUrl || oldUrl.startsWith('http://') || oldUrl.startsWith('https://') || oldUrl.startsWith('data:')) {
        return;
      }
      try {
        const oldFilePath = path.join(process.cwd(), 'public', oldUrl);
        await fs.unlink(oldFilePath);
        console.log("Old signature deleted:", oldUrl);
      } catch (err) {
        console.log("Could not delete old signature (file may not exist):", err.message);
      }
    };

    if (signatureFile && typeof signatureFile !== "string" && signatureFile.name) {
      console.log("Processing signature file upload in PUT:", signatureFile.name);
      
      await deleteOldSignature(oldSignatureUrl);
      
      const bytes = await signatureFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-004").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-${signatureFile.name}`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-004").urlDir}/${fileName}`;
      console.log("Signature saved to:", signatureUrl);
    } else if (body.signatureBlock?.signature && body.signatureBlock.signature.startsWith("data:image")) {
      console.log("Processing base64 signature from signatureBlock in PUT");
      
      await deleteOldSignature(oldSignatureUrl);
      
      const base64Data = body.signatureBlock.signature.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-004").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-signature.png`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-004").urlDir}/${fileName}`;
      console.log("Base64 signature from signatureBlock saved to:", signatureUrl);
    } else if (body.signatureBlock?.signature && !body.signatureBlock.signature.startsWith("http") && !body.signatureBlock.signature.startsWith("/")) {
      console.log("Processing raw base64 from signatureBlock in PUT");
      try {
        await deleteOldSignature(oldSignatureUrl);
        
        const buffer = Buffer.from(body.signatureBlock.signature, "base64");
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-004").physicalDir);
        await fs.mkdir(uploadDir, { recursive: true });

        const fileName = `${Date.now()}-signature.png`;
        const filePath = path.join(uploadDir, fileName);

        await fs.writeFile(filePath, buffer);
        signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-004").urlDir}/${fileName}`;
        console.log("Raw base64 signature from signatureBlock saved to:", signatureUrl);
      } catch (err) {
        console.error("Failed to process raw base64 signature:", err);
      }
    } else if (body.signature?.signature && body.signature.signature.startsWith("data:image")) {
      console.log("Processing base64 signature from body.signature in PUT");
      
      await deleteOldSignature(oldSignatureUrl);
      
      const base64Data = body.signature.signature.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-004").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-signature.png`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-004").urlDir}/${fileName}`;
      console.log("Base64 signature from body.signature saved to:", signatureUrl);
    }

    const revisionNo = incrementRevisionForUpdate(existing.documentInfo?.revisionNo);

    console.log("Updating OPS-OFD-004 with data:", {
      operationRef: existing.operationRef,
      signaturePresent: !!signatureUrl
    });

    const updateData = {
      documentInfo: {
        ...(body.documentInfo || existing.documentInfo || {}),
        revisionNo,
        revisionDate: body.documentInfo?.revisionDate
          ? new Date(body.documentInfo.revisionDate)
          : (existing.documentInfo?.revisionDate || new Date()),
      },
      transferInfo: body.transferInfo || existing.transferInfo || {},
      checklist4A: body.checklist4A || existing.checklist4A || {},
      checklist4B: body.checklist4B || existing.checklist4B || {},
      checklist4C: body.checklist4C || existing.checklist4C || [],
      checklist4D: body.checklist4D || existing.checklist4D || [],
      checklist4E: body.checklist4E || existing.checklist4E || {},
      checklist4F: body.checklist4F || existing.checklist4F || {},
      signature: {
        name: body.signature?.name || existing.signature?.name || "",
        rank: body.signature?.rank || existing.signature?.rank || "",
        signature: signatureUrl || existing.signature?.signature || "",
        date: body.signature?.date
          ? new Date(body.signature.date)
          : existing.signature?.date || new Date(),
      },
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedChecklist = await STSChecklist4AF.findOneAndUpdate(
      { operationRef },
      updateData,
      { new: true, runValidators: true }
    );

    await createAndScheduleJob(null, "generate-ops-ofd-004", {
      checklistId: updatedChecklist._id.toString(),
      operationRef: updatedChecklist.operationRef,
    });

    void notifyOperationsEdit("OPS-OFD-004", updatedChecklist._id);
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
