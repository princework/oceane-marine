import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { connectDB } from "@/lib/config/connection";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import Equipment from "@/lib/mongodb/models/pms/Equipment";
import { buildStsCreateDocument } from "@/lib/operations/stsCreatePayload";
import {
  EQUIPMENT_SOURCES,
  getOpenDefectCounts,
  optionKey,
  resolveEquipmentIds,
} from "@/lib/pms/equipmentOptions";
import { saveUploadedFile, subfolderForField } from "@/lib/utils/sts-file-storage";
import mongoose from "mongoose";

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
  "checklist1",
  "checklist2",
  "checklist3AB",
  "checklist4AF",
  "checklist5AC",
  "checklist6AB",
  "checklist7",
  "stsTimesheet",
  "standingOrder",
  "stsEquipChecklistPriorOps",
  "stsEquipChecklistAfterOps",
  "chsFeedback",
  "msFeedback",
  "hourlyChecks",
  "restHoursCKL",
  "incidentReporting",
];

export async function POST(req) {
  await connectDB();

  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.operationsRole !== "editor") {
      return NextResponse.json({ error: "Forbidden: Editor role required" }, { status: 403 });
    }

    const formData = await req.formData();

    /* =====================
       EXTRACT TEXT FIELDS
    ====================== */
    const body = {};
    formData.forEach((value, key) => {
      if (typeof value === "string") {
        body[key] = value;
      }
    });

    /* =====================
       HANDLE FILE UPLOADS (CHS/MS vessel documents)
    ====================== */
    const uploadedFiles = {};

    for (const field of FILE_UPLOAD_FIELDS) {
      const file = formData.get(field);
      if (file && typeof file !== "string" && file.name && file.size > 0) {
        uploadedFiles[field] = await saveUploadedFile(file, subfolderForField(field));
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
       OPTIONAL MULTI-FILE DOCUMENTATION (Equipment & Remarks section)
    ====================== */
    const manualDocumentationEntries = [];
    const documentationFiles = formData
      .getAll("documentationFiles")
      .filter((f) => f && typeof f !== "string" && f.name && f.size > 0);
    for (const file of documentationFiles) {
      const filePath = await saveUploadedFile(file, "documentation-extra");
      const displayName =
        file.name.replace(/[^\w.\- ]/g, "_").slice(0, 200) || "attachment";
      manualDocumentationEntries.push({
        documentType: displayName,
        filePath,
        source: "MANUAL_UPLOAD",
      });
    }

    /* =====================
       EQUIPMENT VALIDATION
    ====================== */
    const equipmentIds = formData
      .getAll("equipments")
      .filter((v) => typeof v === "string" && v.trim() !== "")
      .map((v) => v.trim());

    // Ids arrive without a source, so both PMS collections are checked.
    let equipmentUnits = [];
    if (equipmentIds.length > 0) {
      const { resolved, missing } = await resolveEquipmentIds(equipmentIds);

      if (missing.length > 0) {
        return NextResponse.json(
          { error: "One or more selected equipments no longer exist in PMS" },
          { status: 400 }
        );
      }

      equipmentUnits = equipmentIds.map((id) => resolved.get(id));

      // Primary equipment committed to another operation stays unavailable —
      // pre-existing rule, kept. Accessories have no equivalent in-use flag.
      const inUse = equipmentUnits.filter((unit) => unit.isInUse);
      if (inUse.length > 0) {
        return NextResponse.json(
          {
            error: `Already in use by another operation: ${inUse
              .map((unit) => unit.label || unit.name)
              .join(", ")}`,
          },
          { status: 400 }
        );
      }

      // Mirrors the disabled options in the form. Without this the block is
      // cosmetic — a stale page or a direct POST would slip straight past it.
      const retired = equipmentUnits.filter(
        (unit) =>
          unit.source === EQUIPMENT_SOURCES.PRIMARY && unit.status === "RETIRED"
      );
      if (retired.length > 0) {
        return NextResponse.json(
          {
            error: `Retired equipment cannot be used: ${retired
              .map((unit) => unit.label || unit.name)
              .join(", ")}`,
          },
          { status: 400 }
        );
      }

      const defectCounts = await getOpenDefectCounts();
      const defected = equipmentUnits.filter((unit) =>
        defectCounts.get(optionKey(unit.source, unit.id))
      );
      if (defected.length > 0) {
        return NextResponse.json(
          {
            error: `Equipment with an open defect cannot be used: ${defected
              .map((unit) => unit.label || unit.name)
              .join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    /* =====================
       OPERATION TIMES
    ====================== */
    const operationStartTime = body.operationStartTime
      ? new Date(body.operationStartTime)
      : new Date();
    const operationEndTime = body.operationEndTime
      ? new Date(body.operationEndTime)
      : null;

    /* =====================
       EQUIPMENT USAGE
    ====================== */
    const equipmentUsage = equipmentUnits.map((unit) => ({
      equipment: unit.id,
      equipmentSource: unit.source,
      equipmentName: unit.name,
      startTime: operationStartTime,
      status: "IN_USE",
    }));

    /* =====================
       CREATE STS OPERATION
    ====================== */
    const parentOperationId = new mongoose.Types.ObjectId();

    // Ensure operationStatus is set (default to INPROGRESS for draft)
    const operationStatus = body.operationStatus || "INPROGRESS";
    
    const isSubmitted = body.isSubmitted === "true" || body.isSubmitted === true;

    const { equipments: _omitEquipments, ...bodyWithoutEquipments } = body;

    const createDoc = buildStsCreateDocument({
      body: {
        ...bodyWithoutEquipments,
        operationStatus,
        isSubmitted,
        submittedAt: body.submittedAt,
      },
      uploadedFiles,
      equipmentUsage,
      manualDocumentationEntries,
      parentOperationId,
      operationStartTime,
      operationEndTime,
    });

    const stsOperation = await StsOperation.create(createDoc);

    /* =====================
       LOCK EQUIPMENTS
    ====================== */
    // Primary equipment only — accessories have no in-use flag, and passing
    // their ids to the Equipment collection would just match nothing.
    const primaryEquipmentIds = equipmentUnits
      .filter((unit) => unit.source === EQUIPMENT_SOURCES.PRIMARY)
      .map((unit) => unit.id);

    if (primaryEquipmentIds.length > 0) {
      await Equipment.updateMany(
        { _id: { $in: primaryEquipmentIds } },
        {
          isInUse: true,
          lastUsedAt: new Date(),
        }
      );
    }

    return NextResponse.json(
      {
        message: "STS Operation created successfully",
        data: stsOperation,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("STS CREATE ERROR:", error);
    const status = error.statusCode || (error.name === "ValidationError" ? 400 : 500);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
