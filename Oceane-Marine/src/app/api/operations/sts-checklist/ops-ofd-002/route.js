import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklistTwo from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-002";
import { incrementRevisionForUpdate } from "../revision.js";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-002.job.js";
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

    const checklist = await STSChecklistTwo.findOne({ operationRef }).lean();

    console.log('[OPS-OFD-002 GET] Found checklist:', {
      operationRef,
      hasChecklist: !!checklist,
      checklistItemsCount: checklist?.checklistItems?.length || 0,
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

    const existing = await STSChecklistTwo.findOne({ operationRef }).lean();

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
    let oldSignatureUrl = existing.signature?.signature; // Store old signature for deletion

    // Helper function to delete old signature file
    const deleteOldSignature = async (oldUrl) => {
      if (!oldUrl || oldUrl.startsWith('http://') || oldUrl.startsWith('https://') || oldUrl.startsWith('data:')) {
        return; // Don't delete if it's a full URL or base64
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
      
      // Delete old signature before saving new one
      await deleteOldSignature(oldSignatureUrl);
      
      const bytes = await signatureFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-002").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-${signatureFile.name}`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-002").urlDir}/${fileName}`;
      console.log("Signature saved to:", signatureUrl);
    } else if (body.signatureBlock?.signature && body.signatureBlock.signature.startsWith("data:image")) {
      // Handle base64 signature from signatureBlock
      console.log("Processing base64 signature from signatureBlock in PUT");
      
      // Delete old signature before saving new one
      await deleteOldSignature(oldSignatureUrl);
      
      const base64Data = body.signatureBlock.signature.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-002").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-signature.png`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-002").urlDir}/${fileName}`;
      console.log("Base64 signature from signatureBlock saved to:", signatureUrl);
    } else if (body.signatureBlock?.signature && !body.signatureBlock.signature.startsWith("http") && !body.signatureBlock.signature.startsWith("/")) {
      // Handle raw base64 from signatureBlock (without data:image prefix)
      console.log("Processing raw base64 from signatureBlock in PUT");
      try {
        // Delete old signature before saving new one
        await deleteOldSignature(oldSignatureUrl);
        
        const buffer = Buffer.from(body.signatureBlock.signature, "base64");
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-002").physicalDir);
        await fs.mkdir(uploadDir, { recursive: true });

        const fileName = `${Date.now()}-signature.png`;
        const filePath = path.join(uploadDir, fileName);

        await fs.writeFile(filePath, buffer);
        signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-002").urlDir}/${fileName}`;
        console.log("Raw base64 signature from signatureBlock saved to:", signatureUrl);
      } catch (err) {
        console.error("Failed to process raw base64 signature:", err);
        // Keep existing signature if processing fails
      }
    } else if (body.signature?.signature && body.signature.signature.startsWith("data:image")) {
      // Handle base64 signature from body.signature (legacy support)
      console.log("Processing base64 signature from body.signature in PUT");
      
      // Delete old signature before saving new one
      await deleteOldSignature(oldSignatureUrl);
      
      const base64Data = body.signature.signature.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-002").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-signature.png`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-002").urlDir}/${fileName}`;
      console.log("Base64 signature from body.signature saved to:", signatureUrl);
    }

    const revisionNo = incrementRevisionForUpdate(existing.documentInfo?.revisionNo);

    // Handle different field names from frontend
    const rawChecklistItems = body.checklistItems || body.genericChecks || body.checks;
    
    // Transform frontend data format to match MongoDB schema if new data provided
    // Frontend sends: { id, description, status: boolean, notApplicable: boolean, userRemark }
    // MongoDB expects: { clNumber, description, status: { yes, notApplicable }, remarks }
    const checklistItems = rawChecklistItems 
      ? rawChecklistItems.map(item => ({
          clNumber: item.id || item.clNumber,
          description: item.description,
          status: {
            yes: item.status === true,
            notApplicable: item.notApplicable === true
          },
          remarks: item.userRemark || item.remarks || ""
        }))
      : existing.checklistItems || [];

    console.log("Updating OPS-OFD-002 with data:", {
      operationRef: existing.operationRef,
      checklistItemsCount: checklistItems.length,
      signaturePresent: !!signatureUrl || !!body.signature?.signature
    });

    const updateData = {
      documentInfo: {
        ...(body.documentInfo || existing.documentInfo || {}),
        revisionNo,
        issueDate: body.documentInfo?.issueDate
          ? new Date(body.documentInfo.issueDate)
          : (existing.documentInfo?.issueDate || new Date()),
      },
      transferInfo: {
        constantHeadingShip: body.constantHeadingShip || body.transferInfo?.constantHeadingShip || existing.transferInfo?.constantHeadingShip || "",
        manoeuvringShip: body.maneuveringShip || body.transferInfo?.manoeuvringShip || existing.transferInfo?.manoeuvringShip || "",
        designatedPOACName: body.nameOfDesignatedPOAC || body.transferInfo?.designatedPOACName || existing.transferInfo?.designatedPOACName || "",
        stsSuperintendentName: body.nameOfSTSSuperintendent || body.transferInfo?.stsSuperintendentName || existing.transferInfo?.stsSuperintendentName || "",
        transferDate: body.dateOfTransfer || body.transferInfo?.transferDate || existing.transferInfo?.transferDate,
        transferLocation: body.locationOfTransfer || body.transferInfo?.transferLocation || existing.transferInfo?.transferLocation || ""
      },
      checklistItems: checklistItems,
      signature: {
        name: body.signature?.name || existing.signature?.name || "",
        rank: body.signature?.rank || existing.signature?.rank || "",
        signature: signatureUrl || body.signature?.signature || existing.signature?.signature || "",
        date: body.signature?.date
          ? new Date(body.signature.date)
          : existing.signature?.date,
      },
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedChecklist = await STSChecklistTwo.findOneAndUpdate(
      { operationRef },
      updateData,
      { new: true, runValidators: true }
    );

    await createAndScheduleJob(null, "generate-ops-ofd-002", {
      checklistId: updatedChecklist._id.toString(),
      operationRef: updatedChecklist.operationRef,
    });

    void notifyOperationsEdit("OPS-OFD-002", updatedChecklist._id);
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
