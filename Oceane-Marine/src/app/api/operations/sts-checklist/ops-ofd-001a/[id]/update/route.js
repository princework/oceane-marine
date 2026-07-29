import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import ShipStandardQuestionnaire from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-001-A";
import { incrementRevisionForUpdate } from "../../../revision";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-001a.job.js";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";
import { buildOperationsStsSignatureDirs } from "@/lib/utils/signature-storage";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const formData = await req.formData();
    const dataStr = formData.get("data");

    if (!dataStr) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const body = JSON.parse(dataStr);

    // Get existing questionnaire
    const existing = await ShipStandardQuestionnaire.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Questionnaire not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Handle signature file upload if provided
    const signatureFile = formData.get("signature");
    let signatureUrl = body.signature?.signature || existing.signature?.signature;
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

    console.log("OPS-OFD-001A Signature handling (UPDATE):", {
      signatureFileExists: !!signatureFile,
      signatureFileType: typeof signatureFile,
      signatureFileName: signatureFile?.name,
      bodySignature: body.signature?.signature?.substring(0, 50) + "..."
    });

    if (signatureFile && typeof signatureFile !== "string" && signatureFile.name) {
      console.log("Processing signature file upload in UPDATE:", signatureFile.name);
      await deleteOldSignature(oldSignatureUrl);
      
      const bytes = await signatureFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-001").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-${signatureFile.name}`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-001").urlDir}/${fileName}`;
      console.log("Signature saved to:", signatureUrl);
    } else if (body.signature?.signature && body.signature.signature.startsWith("data:image")) {
      console.log("Processing base64 signature from body.signature in UPDATE");
      await deleteOldSignature(oldSignatureUrl);
      
      const base64Data = body.signature.signature.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-001").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-signature.png`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-001").urlDir}/${fileName}`;
      console.log("Base64 signature saved to:", signatureUrl);
    } else if (body.signature?.signature && !body.signature.signature.startsWith("http") && !body.signature.signature.startsWith("/")) {
      console.log("Processing raw base64 from body.signature in UPDATE");
      try {
        await deleteOldSignature(oldSignatureUrl);
        
        const buffer = Buffer.from(body.signature.signature, "base64");
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-001").physicalDir);
        await fs.mkdir(uploadDir, { recursive: true });

        const fileName = `${Date.now()}-signature.png`;
        const filePath = path.join(uploadDir, fileName);

        await fs.writeFile(filePath, buffer);
        signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-001").urlDir}/${fileName}`;
        console.log("Raw base64 signature saved to:", signatureUrl);
      } catch (err) {
        console.error("Failed to process raw base64 signature:", err);
      }
    }

    console.log("[OPS-OFD-001A UPDATE by ID] Received body keys:", Object.keys(body));
    console.log("[OPS-OFD-001A UPDATE by ID] body.basicInfo:", body.basicInfo);
    console.log("[OPS-OFD-001A UPDATE by ID] body.documentInfo:", body.documentInfo);

    // ✅ Read from body.basicInfo and body.documentInfo (matching frontend payload structure)
    const updateData = {
      documentInfo: {
        formNo: body.documentInfo?.formNo || body.formNo || existing.documentInfo?.formNo || "OPS-OFD-001A",
        revisionNo: incrementRevisionForUpdate(existing.documentInfo?.revisionNo),
        revisionDate: body.documentInfo?.revisionDate
          ? new Date(body.documentInfo.revisionDate)
          : body.revisionDate
            ? new Date(body.revisionDate)
            : existing.documentInfo?.revisionDate,
        approvedBy: body.documentInfo?.approvedBy || body.approvedBy || existing.documentInfo?.approvedBy || "JS",
      },
      basicInfo: {
        proposedLocation: body.basicInfo?.proposedLocation || body.proposedLocation || existing.basicInfo?.proposedLocation || "",
        shipName: body.basicInfo?.shipName || body.shipName || existing.basicInfo?.shipName || "",
        date: body.basicInfo?.date
          ? new Date(body.basicInfo.date)
          : body.date
            ? new Date(body.date)
            : existing.basicInfo?.date,
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
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    console.log("[OPS-OFD-001A UPDATE by ID] Saving basicInfo:", updateData.basicInfo);
    console.log("[OPS-OFD-001A UPDATE by ID] Saving documentInfo:", updateData.documentInfo);

    const updatedQuestionnaire = await ShipStandardQuestionnaire.findByIdAndUpdate(
      id,
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
        message: "OPS-OFD-001A questionnaire updated successfully & doc regeneration started",
        data: updatedQuestionnaire,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-001A update error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
