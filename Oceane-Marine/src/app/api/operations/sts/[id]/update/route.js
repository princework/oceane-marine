import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import Equipment from "@/lib/mongodb/models/pms/Equipment";
import Accessories from "@/lib/mongodb/models/pms/Accessories";
import MooringMaster from "@/lib/mongodb/models/MooringMaster";
import { saveUploadedFile, subfolderForField } from "@/lib/utils/sts-file-storage";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";
import { releaseOperationResources } from "@/lib/operations/releaseOperationResources";
import {
  EQUIPMENT_SOURCES,
  getOpenDefectCounts,
  optionKey,
  resolveEquipmentIds,
} from "@/lib/pms/equipmentOptions";

/** Document sources the operator may add or remove from the general attachments list. */
const OPERATOR_MANAGED_DOC_SOURCES = new Set(["MANUAL_UPLOAD", "EMAIL_IMPORT"]);

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

    /* Form sends equipment IDs as strings; schema expects embedded usage objects.
       Resolved into `updatedEquipments` below — never taken from `body` directly. */
    delete body.equipments;

    /* An empty/unselected enum field ("Select" placeholder) must not overwrite
       the existing value with "" — Mongoose rejects "" against an enum even
       when the field is optional. Mirrors buildStsCreateDocument's `if (x)
       doc.x = x` guard on the create path, which this generic `...body`
       spread doesn't otherwise get. */
    for (const field of ["operationType", "vesselTypeCHS", "vesselTypeMS", "flowDirection"]) {
      if (body[field] === "" || body[field] === "Select") delete body[field];
    }

    /* =====================
       HANDLE FILE UPLOADS (CHS/MS vessel documents)
    ====================== */
    const uploadedFiles = {};

    for (const field of FILE_UPLOAD_FIELDS) {
      const file = formData.get(field);
      if (file && typeof file !== "string" && file.name && file.size > 0) {
        uploadedFiles[field] = await saveUploadedFile(file, subfolderForField(field));
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

    /* Apply keep/remove + replacement deletions only to operator-managed entries.
       System-generated and checklist documents are protected; email-imported
       attachments are removable, same as manual uploads. */
    const filteredPrior = priorDocuments.filter((d) => {
      if (!OPERATOR_MANAGED_DOC_SOURCES.has(d?.source)) return true;
      if (replacedMap.has(d.filePath)) return false; // replaced → drop old version
      if (keepEnabled) return keepPaths.has(d.filePath);
      return true;
    });

    const mergedDocuments = [...filteredPrior, ...newManualDocumentationEntries];

    /* =====================
       EQUIPMENT USAGE — resolve the submitted selection against what the
       operation already had. Ids arrive without a source, same as create.
    ====================== */
    const submittedEquipmentIds = [
      ...new Set(
        formData
          .getAll("equipments")
          .filter((v) => typeof v === "string" && v.trim() !== "")
          .map((v) => v.trim())
      ),
    ];

    const priorUsage = Array.isArray(existing.equipments) ? existing.equipments : [];
    const activeIds = new Set(
      priorUsage
        .filter((eq) => eq.status === "IN_USE")
        .map((eq) => String(eq.equipment))
    );

    const newlySelectedIds = submittedEquipmentIds.filter((id) => !activeIds.has(id));
    const deselectedIds = [...activeIds].filter((id) => !submittedEquipmentIds.includes(id));

    // Keep released history as-is; keep still-selected active entries as-is (preserves
    // their original startTime); drop anything the operator just deselected.
    let updatedEquipments = priorUsage.filter((eq) => {
      if (eq.status !== "IN_USE") return true;
      return submittedEquipmentIds.includes(String(eq.equipment));
    });

    if (newlySelectedIds.length > 0) {
      const { resolved, missing } = await resolveEquipmentIds(newlySelectedIds);
      if (missing.length > 0) {
        return NextResponse.json(
          { error: "One or more selected equipments no longer exist in PMS" },
          { status: 400 }
        );
      }

      const newUnits = newlySelectedIds.map((id) => resolved.get(id));

      const inUse = newUnits.filter((unit) => unit.isInUse);
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

      const retired = newUnits.filter(
        (unit) => unit.source === EQUIPMENT_SOURCES.PRIMARY && unit.status === "RETIRED"
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
      const defected = newUnits.filter((unit) =>
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

      const startBasis = body.operationStartTime
        ? new Date(body.operationStartTime)
        : existing.operationStartTime || new Date();

      updatedEquipments = [
        ...updatedEquipments,
        ...newUnits.map((unit) => ({
          equipment: unit.id,
          equipmentSource: unit.source,
          equipmentName: unit.name,
          startTime: startBasis,
          status: "IN_USE",
        })),
      ];

      const newPrimaryIds = newUnits
        .filter((unit) => unit.source === EQUIPMENT_SOURCES.PRIMARY)
        .map((unit) => unit.id);
      if (newPrimaryIds.length > 0) {
        await Equipment.updateMany(
          { _id: { $in: newPrimaryIds } },
          { isInUse: true, lastUsedAt: new Date() }
        );
      }

      const newAccessoryIds = newUnits
        .filter((unit) => unit.source === EQUIPMENT_SOURCES.ACCESSORY)
        .map((unit) => unit.id);
      if (newAccessoryIds.length > 0) {
        await Accessories.updateMany(
          { _id: { $in: newAccessoryIds } },
          { isInUse: true }
        );
      }
    }

    if (deselectedIds.length > 0) {
      const now = new Date();
      for (const eq of priorUsage) {
        if (eq.status !== "IN_USE" || !deselectedIds.includes(String(eq.equipment))) continue;
        if ((eq.equipmentSource || "Equipment") === "Equipment") {
          await Equipment.findByIdAndUpdate(eq.equipment, { isInUse: false, lastUsedAt: now });
        } else if (eq.equipmentSource === "Accessories") {
          await Accessories.findByIdAndUpdate(eq.equipment, { isInUse: false });
        }
      }
    }

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

    /* Release the equipment and mooring master locked to this operation back to
       the pool the moment it completes. Guarded on the actual transition (not
       just "this save is COMPLETED") so re-saving an already-completed
       operation never releases a mooring master/equipment that has since been
       picked up by a different operation. */
    const becomingCompleted =
      body.operationStatus === "COMPLETED" && existing.operationStatus !== "COMPLETED";
    const releasedEquipments = becomingCompleted
      ? await releaseOperationResources({
          equipments: updatedEquipments,
          mooringMaster: existing.mooringMaster,
        })
      : undefined;

    /* Mooring master reassignment: the create route locks whoever gets picked
       (availabilityStatus "ASSIGNED"), but the edit form was never wired to do
       the same — so a mooring master assigned only via an edit stayed marked
       AVAILABLE forever, letting another operation pick the same person.
       `mooringMaster` is stripped from the submission when the field is left
       on "Select" (see the enum-field guard above), so its presence in `body`
       always means the operator actually changed it. */
    const existingMooringMasterId = existing.mooringMaster ? String(existing.mooringMaster) : null;
    const submittedMooringMasterId =
      typeof body.mooringMaster === "string" && body.mooringMaster.trim() !== ""
        ? body.mooringMaster.trim()
        : undefined;
    const mooringMasterChanged =
      submittedMooringMasterId !== undefined && submittedMooringMasterId !== existingMooringMasterId;

    if (mooringMasterChanged && existingMooringMasterId && !becomingCompleted) {
      await MooringMaster.findByIdAndUpdate(existingMooringMasterId, {
        availabilityStatus: "AVAILABLE",
        currentOperation: null,
      });
    }

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
      equipments: releasedEquipments || updatedEquipments,
    });

    if (mooringMasterChanged && submittedMooringMasterId) {
      await MooringMaster.findByIdAndUpdate(submittedMooringMasterId, {
        availabilityStatus: "ASSIGNED",
        currentOperation: newVersion._id,
      });
    }

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
