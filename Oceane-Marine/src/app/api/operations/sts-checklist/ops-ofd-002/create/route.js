import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklistTwo from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-002";
import { getNextRevisionForCreate } from "../../revision";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-002.job.js";
import { buildOperationsStsSignatureDirs } from "@/lib/utils/signature-storage";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  await connectDB();

  try {
    const formData = await req.formData();
    const dataStr = formData.get("data");
    
    if (!dataStr) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const body = JSON.parse(dataStr);

    // Handle signature file upload if provided
    const signatureFile = formData.get("signature");
    let signatureUrl = body.signature?.signature;

    console.log("Signature handling:", {
      signatureFileExists: !!signatureFile,
      signatureFileType: typeof signatureFile,
      signatureFileName: signatureFile?.name,
      bodySignature: body.signature?.signature?.substring(0, 50) + "..."
    });

    if (signatureFile && typeof signatureFile !== "string" && signatureFile.name) {
      console.log("Processing signature file upload:", signatureFile.name);
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
      console.log("Processing base64 signature from signatureBlock");
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
      console.log("Processing raw base64 from signatureBlock");
      try {
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
      console.log("Processing base64 signature from body.signature");
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

    if (!body.operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const revisionNo = await getNextRevisionForCreate(STSChecklistTwo);

    // Handle different field names from frontend
    // Frontend might send: genericChecks, checklistItems, or checks
    const rawChecklistItems = body.checklistItems || body.genericChecks || body.checks || [];
    
    // Transform frontend data format to match MongoDB schema
    // Frontend sends: { id, description, status: boolean, notApplicable: boolean, userRemark }
    // MongoDB expects: { clNumber, description, status: { yes, notApplicable }, remarks }
    const checklistItems = rawChecklistItems.map(item => ({
      clNumber: item.id || item.clNumber,
      description: item.description,
      status: {
        yes: item.status === true,
        notApplicable: item.notApplicable === true
      },
      remarks: item.userRemark || item.remarks || ""
    }));
    
    console.log("Creating OPS-OFD-002 with data:", {
      operationRef: body.operationRef,
      checklistItemsCount: checklistItems.length,
      firstItem: checklistItems[0],
      signature: body.signature
    });

    // Prepare the document data
    const documentData = {
      operationRef: body.operationRef,
      documentInfo: {
        ...(body.documentInfo || {}),
        formNo: body.documentInfo?.formNo || "OPS-OFD-002",
        revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : new Date(),
        approvedBy: body.documentInfo?.approvedBy || "JS",
      },
      transferInfo: {
        constantHeadingShip: body.constantHeadingShip || body.transferInfo?.constantHeadingShip || "",
        manoeuvringShip: body.maneuveringShip || body.transferInfo?.manoeuvringShip || "",
        designatedPOACName: body.nameOfDesignatedPOAC || body.transferInfo?.designatedPOACName || "",
        stsSuperintendentName: body.nameOfSTSSuperintendent || body.transferInfo?.stsSuperintendentName || "",
        transferDate: body.dateOfTransfer || body.transferInfo?.transferDate,
        transferLocation: body.locationOfTransfer || body.transferInfo?.transferLocation || ""
      },
      checklistItems: checklistItems,
      signature: {
        name: body.signature?.name || "",
        rank: body.signature?.rank || "",
        signature: signatureUrl || body.signature?.signature || "",
        date: body.signature?.date ? new Date(body.signature.date) : undefined,
      },
      status: body.status || "DRAFT",
      createdBy: body.createdBy || undefined,
    };

    const newChecklist = await STSChecklistTwo.create(documentData);

    // Trigger DOCX generation
    await createAndScheduleJob(null, "generate-ops-ofd-002", {
      checklistId: newChecklist._id.toString(),
      operationRef: newChecklist.operationRef,
    });

    return NextResponse.json(
      {
        message: "OPS-OFD-002 checklist created successfully & doc generation started",
        data: newChecklist,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-002 create error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
