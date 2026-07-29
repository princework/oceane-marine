import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import PoacMatrix from "@/lib/mongodb/models/hr/PoacMatrix";
import path from "path";
import fs from "fs/promises";
import { assertHrPermission } from "@/lib/auth/hrGuard";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

/* Fields that can have a conditional file upload when set to "Yes" */
const OPTION_FILE_FIELDS = [
  "validPassport",
  "validMastersCOC",
  "dangerousCargoEndorsementOil",
  "dangerousCargoEndorsementChem",
  "dangerousCargoEndorsementGas",
  "oilSpillResponseTraining",
  "stsSimulatorTraining",
  "vesselSizeLimitations",
  "underwayOperations",
  "validMedicals",
];

const sanitize = (str) => str.replace(/[^a-zA-Z0-9-_]/g, "_");

function parseVisaEntries(formData, rowIndex) {
  const raw = formData.get(`row_${rowIndex}_visaEntries`);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((e) => ({
            location: String(e?.location || "").trim(),
            validity: String(e?.validity || "").trim(),
          }))
          .filter((e) => e.location);
      }
    } catch {
      /* fall through */
    }
  }
  const legacyLocRaw = formData.get(`row_${rowIndex}_visaLocation`) || "[]";
  let locs = [];
  try {
    locs = JSON.parse(legacyLocRaw);
    if (!Array.isArray(locs)) locs = legacyLocRaw ? [legacyLocRaw] : [];
  } catch {
    locs = legacyLocRaw ? [String(legacyLocRaw)] : [];
  }
  const legacyValidity = String(formData.get(`row_${rowIndex}_visaValidity`) || "").trim();
  return locs
    .map((location) => String(location || "").trim())
    .filter(Boolean)
    .map((location) => ({
      location,
      validity: legacyValidity,
    }));
}

async function deleteFileIfExists(fileUrl) {
  if (!fileUrl) return;
  try {
    const filePath = path.join(process.cwd(), "public", fileUrl);
    await fs.unlink(filePath).catch(() => {});
  } catch (err) {
    console.error("Error deleting file:", err);
  }
}

async function saveFile(file, stsServiceProvider, poacName, subfolder) {
  const sanitizedProvider = sanitize((stsServiceProvider || "").trim()) || "unknown";
  const sanitizedName = sanitize((poacName || "").trim()) || "unknown";

  // Ensure base directory exists first
  const baseUploadDir = path.join(process.cwd(), "public/uploads/hr/poac-matrix");
  await fs.mkdir(baseUploadDir, { recursive: true });

  const baseDir = path.join(
    baseUploadDir,
    sanitizedProvider,
    sanitizedName,
    subfolder || "main"
  );
  await fs.mkdir(baseDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = `${Date.now()}-${sanitize(file.name)}`;
  const filePath = path.join(baseDir, fileName);
  await fs.writeFile(filePath, buffer);

  return {
    fileUrl: `/uploads/hr/poac-matrix/${sanitizedProvider}/${sanitizedName}/${subfolder}/${fileName}`,
    originalFileName: file.name,
  };
}

export async function PUT(req, { params }) {
  const guard = await assertHrPermission("canEdit");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const { id } = await params;
    const formData = await req.formData();

    const existingRecord = await PoacMatrix.findById(id);
    if (!existingRecord) {
      return NextResponse.json({ message: "POAC Certification Matrix record not found" }, { status: 404 });
    }

    const rowsData = [];
    let rowIndex = 0;

    while (true) {
      const stsServiceProvider = formData.get(`row_${rowIndex}_stsServiceProvider`);
      if (!stsServiceProvider) break;

      const poacName = formData.get(`row_${rowIndex}_poacName`);
      const validPassport = formData.get(`row_${rowIndex}_validPassport`) || "No";
      const validMastersCOC = formData.get(`row_${rowIndex}_validMastersCOC`) || "No";
      const dangerousCargoEndorsementOil = formData.get(`row_${rowIndex}_dangerousCargoEndorsementOil`) || "No";
      const dangerousCargoEndorsementChem = formData.get(`row_${rowIndex}_dangerousCargoEndorsementChem`) || "No";
      const dangerousCargoEndorsementGas = formData.get(`row_${rowIndex}_dangerousCargoEndorsementGas`) || "No";
      const oilSpillResponseTraining = formData.get(`row_${rowIndex}_oilSpillResponseTraining`) || "No";
      const stsSimulatorTraining = formData.get(`row_${rowIndex}_stsSimulatorTraining`) || "No";
      const vesselSizeLimitations = formData.get(`row_${rowIndex}_vesselSizeLimitations`) || "No";
      const underwayOperations = formData.get(`row_${rowIndex}_underwayOperations`) || "No";
      const validMedicals = formData.get(`row_${rowIndex}_validMedicals`) || "No";
      const experienceWithOceane = formData.get(`row_${rowIndex}_experienceWithOceane`);
      const visaEntries = parseVisaEntries(formData, rowIndex);
      const remarks = formData.get(`row_${rowIndex}_remarks`) || "";

      // Validate required fields
      if (!stsServiceProvider || !stsServiceProvider.trim()) {
        return NextResponse.json({ message: `Row ${rowIndex + 1}: STS Service Provider is required` }, { status: 400 });
      }
      if (!poacName || !poacName.trim()) {
        return NextResponse.json({ message: `Row ${rowIndex + 1}: POAC's Name is required` }, { status: 400 });
      }
      if (!["Yes", "No"].includes(validPassport)) {
        return NextResponse.json({ message: `Row ${rowIndex + 1}: Valid Passport must be Yes or No` }, { status: 400 });
      }
      if (!["Yes", "No"].includes(validMastersCOC)) {
        return NextResponse.json({ message: `Row ${rowIndex + 1}: Valid Master's COC must be Yes or No` }, { status: 400 });
      }
      if (!experienceWithOceane || !experienceWithOceane.trim()) {
        return NextResponse.json({ message: `Row ${rowIndex + 1}: Experience with Oceane is required` }, { status: 400 });
      }

      // Get existing row data for preserving files
      const existingRow = existingRecord.rows[rowIndex];

      // Handle multiple main attachments with keep/remove logic
      // 1. Parse which existing attachments to keep
      let keepFileUrls = [];
      const keepAttachmentsRaw = formData.get(`row_${rowIndex}_keepAttachments`);
      if (keepAttachmentsRaw) {
        try { keepFileUrls = JSON.parse(keepAttachmentsRaw); } catch { keepFileUrls = []; }
      }

      // 2. Determine which existing files to keep vs delete
      const oldAttachments = existingRow?.attachments || [];
      // Also handle legacy single attachment
      if (oldAttachments.length === 0 && existingRow?.attachment?.fileUrl) {
        oldAttachments.push(existingRow.attachment);
      }
      const keptAttachments = [];
      for (const att of oldAttachments) {
        if (keepFileUrls.includes(att.fileUrl)) {
          keptAttachments.push(att);
        } else {
          await deleteFileIfExists(att.fileUrl);
        }
      }

      // 3. Handle new file uploads
      const newAttachmentFiles = formData.getAll(`row_${rowIndex}_attachments`);
      const newAttachments = [];
      for (const file of newAttachmentFiles) {
        if (file && typeof file !== "string" && file.name && file.size > 0) {
          const saved = await saveFile(file, stsServiceProvider, poacName, "main");
          newAttachments.push(saved);
        }
      }
      const mergedAttachments = [...keptAttachments, ...newAttachments];

      // Build option values map
      const optionValues = {
        validPassport,
        validMastersCOC,
        dangerousCargoEndorsementOil,
        dangerousCargoEndorsementChem,
        dangerousCargoEndorsementGas,
        oilSpillResponseTraining,
        stsSimulatorTraining,
        vesselSizeLimitations,
        underwayOperations,
        validMedicals,
      };

      const optionFileData = {};
      const optionExpiryData = {};
      for (const field of OPTION_FILE_FIELDS) {
        const fileKey = `${field}File`;
        const expiryKey = `${field}Expiry`;
        const existingFileData = existingRow?.[fileKey] || { fileUrl: "", originalFileName: "" };
        optionExpiryData[expiryKey] = "";

        if (optionValues[field] === "Yes") {
          const expiryVal = formData.get(`row_${rowIndex}_${expiryKey}`) || "";
          optionExpiryData[expiryKey] = expiryVal.trim();

          const optionFile = formData.get(`row_${rowIndex}_${fileKey}`);
          if (optionFile && typeof optionFile !== "string" && optionFile.name && optionFile.size > 0) {
            await deleteFileIfExists(existingFileData?.fileUrl);
            optionFileData[fileKey] = await saveFile(optionFile, stsServiceProvider, poacName, field);
          } else {
            optionFileData[fileKey] = existingFileData;
          }
        } else {
          await deleteFileIfExists(existingFileData?.fileUrl);
          optionFileData[fileKey] = { fileUrl: "", originalFileName: "" };
        }
      }

      rowsData.push({
        stsServiceProvider: stsServiceProvider.trim(),
        poacName: poacName.trim(),
        ...optionValues,
        ...optionExpiryData,
        ...optionFileData,
        experienceWithOceane: experienceWithOceane.trim(),
        visaEntries,
        remarks: remarks ? remarks.trim() : "",
        attachments: mergedAttachments,
      });

      rowIndex++;
    }

    if (rowsData.length === 0) {
      return NextResponse.json({ message: "At least one row is required" }, { status: 400 });
    }

    // Delete old files for removed rows
    if (existingRecord.rows.length > rowsData.length) {
      for (let i = rowsData.length; i < existingRecord.rows.length; i++) {
        const oldRow = existingRecord.rows[i];
        // Delete all main attachments (array)
        for (const att of (oldRow?.attachments || [])) {
          await deleteFileIfExists(att?.fileUrl);
        }
        // Also clean up legacy single attachment
        await deleteFileIfExists(oldRow?.attachment?.fileUrl);
        // Delete per-option files
        for (const field of OPTION_FILE_FIELDS) {
          await deleteFileIfExists(oldRow?.[`${field}File`]?.fileUrl);
        }
      }
    }

    const updatedRecord = await PoacMatrix.findByIdAndUpdate(id, { rows: rowsData }, { new: true });
    void notifyEdit("HR", "poac-matrix · update", id);
    return NextResponse.json({ data: updatedRecord }, { status: 200 });
  } catch (err) {
    console.error("POAC Certification Matrix update error:", err);
    return NextResponse.json({ message: err.message || "Update failed", error: err.message }, { status: 500 });
  }
}
