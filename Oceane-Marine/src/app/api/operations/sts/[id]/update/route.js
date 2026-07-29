import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

/* =====================
   FILE UPLOAD FIELDS (CHS/MS vessel documents)
====================== */
const FILE_UPLOAD_FIELDS = [
  "chsSSQ",
  "chsQ88",
  "chsGAPlan",
  "chsMSDS",
  "chsMooringArrangement",
  "chsIndemnity",
  "msSSQ",
  "msQ88",
  "msGAPlan",
  "msMSDS",
  "msMooringArrangement",
  "msIndemnity",
  "mooringPlan",
];

/* =====================
   TEXT URL FIELDS (other document links)
====================== */
const FILE_URL_FIELDS = [
  "jpo",
  "riskAssessment",
  "DeclarationAtSea",
  "standingOrder",
  "stsEquipChecklistPriorOps",
  "stsEquipChecklistAfterOps",
  "checklist1",
  "checklist2",
  "checklist3AB",
  "checklist4AF",
  "checklist5AC",
  "checklist6AB",
  "checklist7",
  "stsTimesheet",
  "hourlyChecks",
  "incidentReporting",
  "chsFeedback",
  "msFeedback",
  "restHoursCKL",
];

async function saveUploadedFile(file, subfolder) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  const uploadDir = path.join(
    process.cwd(),
    `public/uploads/sts-operations/${subfolder}/${y}/${m}/${d}`
  );
  await fs.mkdir(uploadDir, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const filePath = path.join(uploadDir, fileName);

  await fs.writeFile(filePath, buffer);
  return `/uploads/sts-operations/${subfolder}/${y}/${m}/${d}/${fileName}`;
}

export async function PUT(req, { params }) {
  await connectDB();
  const { id } = await params;

  try {
    const existing = await StsOperation.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Operation not found" },
        { status: 404 }
      );
    }

    if (!existing.isLatest) {
      return NextResponse.json(
        { error: "Only latest version can be updated" },
        { status: 403 }
      );
    }

    const formData = await req.formData();

    const body = {};
    formData.forEach((value, key) => {
      if (typeof value === "string") body[key] = value;
    });

    /* Form sends equipment IDs as strings; schema expects embedded usage objects. */
    delete body.equipments;

    /* =====================
       HANDLE FILE UPLOADS (CHS/MS vessel documents)
    ====================== */
    const uploadedFiles = {};

    for (const field of FILE_UPLOAD_FIELDS) {
      const file = formData.get(field);
      if (file && typeof file !== "string" && file.name && file.size > 0) {
        let subfolder = "chs";
        if (field.startsWith("ms")) subfolder = "ms";
        else if (field === "mooringPlan") subfolder = "mooring-plan";
        uploadedFiles[field] = await saveUploadedFile(file, subfolder);
      } else if (body[`${field}_existing`] && body[`${field}_existing`].trim() !== "") {
        uploadedFiles[field] = body[`${field}_existing`].trim();
      } else if (existing[field]) {
        uploadedFiles[field] = existing[field];
      }
    }

    // Handle replacement file uploads for URL-based fields (e.g. jpoFile → jpo)
    for (const field of FILE_URL_FIELDS) {
      const replacementFile = formData.get(`${field}File`);
      if (replacementFile && typeof replacementFile !== "string" && replacementFile.name && replacementFile.size > 0) {
        uploadedFiles[field] = await saveUploadedFile(replacementFile, field);
      }
    }

    // Extract text-based file URLs (skip if already set by file upload)
    for (const field of FILE_URL_FIELDS) {
      if (uploadedFiles[field]) continue;
      if (body[field] && typeof body[field] === "string" && body[field].trim() !== "") {
        uploadedFiles[field] = body[field].trim();
      }
    }

    /* =====================
       OPTIONAL MULTI-FILE DOCUMENTATION
       - Brand-new files: documentationFiles[]
       - Keep set (manual uploads): documentationKeepEnabled + documentationKeepPaths[]
       - Replace pairs (zipped): documentationReplaceFor[] + documentationReplaceFile[]
    ====================== */
    const newManualDocumentationEntries = [];

    const documentationFiles = formData
      .getAll("documentationFiles")
      .filter((f) => f && typeof f !== "string" && f.name && f.size > 0);
    for (const file of documentationFiles) {
      const filePath = await saveUploadedFile(file, "documentation-extra");
      const displayName =
        file.name.replace(/[^\w.\- ]/g, "_").slice(0, 200) || "attachment";
      newManualDocumentationEntries.push({
        documentType: displayName,
        filePath,
        source: "MANUAL_UPLOAD",
      });
    }

    // Process replacement pairs (one new file per existing path)
    const replaceForRaw = formData.getAll("documentationReplaceFor");
    const replaceFilesRaw = formData.getAll("documentationReplaceFile");
    /** @type {Map<string, string>} oldPath → newPath (after upload) */
    const replacedMap = new Map();
    for (let i = 0; i < replaceForRaw.length; i += 1) {
      const oldPath = typeof replaceForRaw[i] === "string" ? replaceForRaw[i] : "";
      const file = replaceFilesRaw[i];
      if (!oldPath) continue;
      if (!file || typeof file === "string" || !file.name || !file.size) continue;
      const newFilePath = await saveUploadedFile(file, "documentation-extra");
      const displayName =
        file.name.replace(/[^\w.\- ]/g, "_").slice(0, 200) || "attachment";
      replacedMap.set(oldPath, newFilePath);
      newManualDocumentationEntries.push({
        documentType: displayName,
        filePath: newFilePath,
        source: "MANUAL_UPLOAD",
      });
    }

    const keepEnabled = body.documentationKeepEnabled === "true";
    const keepPaths = new Set(formData.getAll("documentationKeepPaths").filter((v) => typeof v === "string"));

    const priorDocuments = Array.isArray(existing.documents)
      ? existing.documents.map((d) => ({ ...d }))
      : [];

    // Apply keep/remove + replacement deletions only to MANUAL_UPLOAD entries.
    const filteredPrior = priorDocuments.filter((d) => {
      if (d?.source !== "MANUAL_UPLOAD") return true;
      if (replacedMap.has(d.filePath)) return false; // replaced → drop old version
      if (keepEnabled) return keepPaths.has(d.filePath);
      return true;
    });

    const mergedDocuments = [...filteredPrior, ...newManualDocumentationEntries];

    // GET LAST VERSION OF THIS OPERATION
    const lastVersion = await StsOperation.findOne({
      parentOperationId: existing.parentOperationId,
    }).sort({ version: -1 });

    const newVersionNumber = Number((lastVersion.version + 0.1).toFixed(1));

    // Mark previous versions as NOT latest
    await StsOperation.updateMany(
      { parentOperationId: existing.parentOperationId },
      { $set: { isLatest: false } }
    );

    // Handle submission status
    const isSubmitted = body.isSubmitted === "true" || body.isSubmitted === true;
    const submittedAt = isSubmitted && body.submittedAt ? new Date(body.submittedAt) : null;

    // CREATE NEW VERSION ENTRY
    const newVersion = await StsOperation.create({
      ...existing.toObject(),
      ...body,
      ...uploadedFiles,
      _id: undefined, // important: create new document, NOT overwrite
      version: newVersionNumber,
      isLatest: true,
      isSubmitted: isSubmitted || existing.isSubmitted, // Preserve if already submitted
      submittedAt: submittedAt || existing.submittedAt, // Preserve if already submitted
      documents: mergedDocuments,
    });

    void notifyOperationsEdit("STS Operations", id);
    return NextResponse.json({
      success: true,
      message: "New version created",
      data: newVersion,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
