import fs from "fs/promises";
import path from "path";
import QhseArchive from "@/lib/mongodb/models/qhse-archive/QhseArchive";
import { sanitizeName } from "@/lib/utils/qhse-file-storage";

export const QHSE_CONTROLLED_DOCUMENTS_ARCHIVE_MODULE = "QHSE Controlled Documents";

/**
 * Copy the current attachment bytes into uploads/qhse-archive/controlled-documents/{docId}/...
 * so archive downloads keep working after the live path is replaced/deleted.
 */
async function copyControlledDocumentFileToArchiveSlot(
  sourceRelativePath,
  docId,
  revLabel,
  originalFileName
) {
  const cwd = process.cwd();
  const normalized = String(sourceRelativePath)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  const srcAbs = path.join(cwd, normalized);
  let buffer;
  try {
    buffer = await fs.readFile(srcAbs);
  } catch (e) {
    console.error(
      "archiveControlledDocumentRevision: cannot read source file:",
      srcAbs,
      e?.message || e
    );
    return null;
  }

  const safeId = sanitizeName(String(docId || "unknown"));
  const dirParts = ["uploads", "qhse-archive", "controlled-documents", safeId];
  const dirAbs = path.join(cwd, ...dirParts);
  await fs.mkdir(dirAbs, { recursive: true });

  const base = originalFileName || path.basename(normalized) || "file";
  const ext = path.extname(base) || "";
  const stem = sanitizeName(path.basename(base, ext)) || "file";
  const safeRev = String(revLabel).replace(/\./g, "_");
  const finalName = `${Date.now()}-rev-${safeRev}-${stem}${ext}`;
  const destAbs = path.join(dirAbs, finalName);
  await fs.writeFile(destAbs, buffer);

  const archiveRelative = [...dirParts, finalName].join("/");
  return { archiveRelativePath: archiveRelative, originalFileName: base };
}

/**
 * Stores prior revision file + snapshot when a controlled document file is replaced or manually archived.
 * Always writes a durable copy under uploads/qhse-archive/controlled-documents/ — the archive row must not
 * reference the live attachment path, which may be deleted on replace.
 * @param {import("mongoose").Document|object} doc - Current DB doc before file swap / rev bump
 * @param {string} reason
 * @param {"replace_on_save"|"manual"} triggeredBy - manual = user-triggered archive without file replacement
 */
export async function archiveControlledDocumentRevision({
  doc,
  reason,
  triggeredBy = "replace_on_save",
}) {
  const snap = doc?.toObject?.() ? doc.toObject() : { ...doc };
  const att = snap.attachment || {};
  const fp = typeof att.filePath === "string" ? att.filePath.trim() : "";
  if (!fp) return null;

  const archivedAt = new Date();
  const revLabel = `${snap.revMajor ?? 1}.${snap.revMinor ?? 0}`;

  const copyResult = await copyControlledDocumentFileToArchiveSlot(
    fp,
    snap._id,
    revLabel,
    typeof att.originalFileName === "string" ? att.originalFileName : ""
  );
  if (!copyResult) return null;

  return QhseArchive.create({
    year: archivedAt.getFullYear(),
    module: QHSE_CONTROLLED_DOCUMENTS_ARCHIVE_MODULE,
    documentType: QHSE_CONTROLLED_DOCUMENTS_ARCHIVE_MODULE,
    formCode: snap.formCode ? String(snap.formCode).trim() : "",
    title: `${snap.title || snap.formCode || "Controlled document"} · Rev ${revLabel} · superseded file`,
    filePath: copyResult.archiveRelativePath,
    fileUrl: "",
    originalId: snap._id ? String(snap._id) : "",
    archivedAt,
    metadata: {
      archiveReason: reason,
      triggeredBy,
      archivedAtIso: archivedAt.toISOString(),
      revMajor: snap.revMajor,
      revMinor: snap.revMinor,
      liveSourcePathAtArchive: fp,
      attachment: { ...att },
      documentSnapshot: JSON.parse(JSON.stringify(snap)),
    },
  });
}
