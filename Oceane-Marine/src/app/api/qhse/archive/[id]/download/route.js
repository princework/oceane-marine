import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import QhseArchive from "@/lib/mongodb/models/qhse-archive/QhseArchive";
import StsBaseAuditReport from "@/lib/mongodb/models/qhse-form-checklist/StsBaseAuditReport";
import NewBaseSetupChecklist from "@/lib/mongodb/models/qhse-form-checklist/NewBaseSetupChecklist";
import StsTransferLocationQuest from "@/lib/mongodb/models/qhse-form-checklist/StsTransferLocationQuest";
import RiskAssessment from "@/lib/mongodb/models/qhse-risk-assessment/RiskAssessment";
import TrainingRecord from "@/lib/mongodb/models/qhse-training/TrainingRecord";
import KpiUpload from "@/lib/mongodb/models/qhse-kpi/KpiUpload";
import EquipmentDefect from "@/lib/mongodb/models/qhse-defect/EquipmentDefect";
import {
  PMS_ACCESSORIES_CERT_ARCHIVE_MODULE,
  PMS_PRIMARY_EQUIPMENT_CERT_ARCHIVE_MODULE,
} from "@/lib/pms/createPmsInventoryCertificateArchiveEntry";

const CONTENT_TYPE_MAP = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const KNOWN_EXTENSIONS = new Set(Object.keys(CONTENT_TYPE_MAP).map((e) => e.slice(1)));

/** Earlier uploads sanitized "." in extensions to "_" (e.g. file_pdf). Recover the real name. */
function recoverMangledExtension(name) {
  if (!name || typeof name !== "string") return name;
  if (path.extname(name)) return name;
  const m = /_([a-zA-Z0-9]{2,5})$/.exec(name);
  if (m && KNOWN_EXTENSIONS.has(m[1].toLowerCase())) {
    return `${name.slice(0, m.index)}.${m[1].toLowerCase()}`;
  }
  return name;
}

/** Detect file type from magic bytes when filename has no/wrong extension. */
function sniffContentTypeAndExt(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { ext: ".pdf", type: "application/pdf" };
  }
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return {
      ext: ".xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }
  if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
    return { ext: ".doc", type: "application/msword" };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: ".jpg", type: "image/jpeg" };
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { ext: ".png", type: "image/png" };
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return { ext: ".gif", type: "image/gif" };
  }
  return null;
}

const cwd = process.cwd();

/** Normalize `/uploads/...` strings for comparison. */
function normalizeUploadRef(u) {
  if (!u || typeof u !== "string") return "";
  return u.trim().replace(/\\/g, "/").replace(/^\/+/, "");
}

/**
 * PMS certificate archives store the real client filename on the record; the file on disk may
 * still use `_pdf` from an older sanitize bug — prefer metadata for Content-Disposition.
 */
function pmsCertArchiveDownloadName(doc) {
  const mod = (doc.module || "").trim();
  if (
    mod !== PMS_PRIMARY_EQUIPMENT_CERT_ARCHIVE_MODULE &&
    mod !== PMS_ACCESSORIES_CERT_ARCHIVE_MODULE
  ) {
    return null;
  }
  const meta =
    doc.metadata && typeof doc.metadata === "object" ? doc.metadata : {};
  const urlKey = normalizeUploadRef(doc.fileUrl || "");
  const m =
    meta.manufacturingCertificate &&
    typeof meta.manufacturingCertificate === "object"
      ? meta.manufacturingCertificate
      : {};
  const t =
    meta.testCertificate && typeof meta.testCertificate === "object"
      ? meta.testCertificate
      : {};
  const mUrlKey = normalizeUploadRef(m.fileUrl || "");
  const tUrlKey = normalizeUploadRef(t.fileUrl || "");
  const mName =
    typeof m.originalFileName === "string" ? m.originalFileName.trim() : "";
  const tName =
    typeof t.originalFileName === "string" ? t.originalFileName.trim() : "";

  const scope = meta.scope;
  if (scope === "manufacturing" && mName) return mName;
  if (scope === "test" && tName) return tName;

  if (urlKey && mUrlKey && urlKey === mUrlKey && mName) return mName;
  if (urlKey && tUrlKey && urlKey === tUrlKey && tName) return tName;

  return mName || tName || null;
}

function normalizePath(raw) {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim().replace(/\\/g, "/");
  return t || null;
}

function resolveFilePath(rawPath) {
  const p = normalizePath(rawPath);
  if (!p) return null;
  const candidates = [
    path.join(cwd, p),
    p.startsWith("/") ? path.join(cwd, p.slice(1)) : null,
    path.join(cwd, "public", p.startsWith("/") ? p.slice(1) : p),
  ].filter(Boolean);
  if (path.isAbsolute(p)) candidates.unshift(p);
  for (const abs of candidates) {
    try {
      if (fs.existsSync(abs)) return abs;
    } catch (_) {}
  }
  return null;
}

function resolveDefectAttachmentPath(defectId, attPath, attOriginalName) {
  if (!attPath || !defectId) return null;
  const relativePath = String(attPath).replace(/\\/g, "/").replace(/^\/+/, "");
  const allowedBase = path.join(cwd, "uploads", "equipment-defects");
  const defectDir = path.join(allowedBase, String(defectId));
  let fullPath = path.resolve(cwd, relativePath);
  const rel = path.relative(allowedBase, fullPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    fullPath = path.join(defectDir, path.basename(relativePath));
  }
  if (fs.existsSync(fullPath)) return { path: fullPath, name: attOriginalName };
  fullPath = path.join(defectDir, path.basename(attPath || ""));
  if (fs.existsSync(fullPath)) return { path: fullPath, name: attOriginalName };
  return null;
}

function streamFile(absolutePath, fileNameOverride = null) {
  const fileBuffer = fs.readFileSync(absolutePath);
  let fileName = fileNameOverride || path.basename(absolutePath);
  fileName = recoverMangledExtension(fileName);
  let fileExt = path.extname(fileName).toLowerCase();
  let contentType = CONTENT_TYPE_MAP[fileExt];
  if (!contentType) {
    const sniffed = sniffContentTypeAndExt(fileBuffer);
    if (sniffed) {
      contentType = sniffed.type;
      if (!fileExt) {
        fileName = `${fileName}${sniffed.ext}`;
        fileExt = sniffed.ext;
      }
    } else {
      contentType = "application/octet-stream";
    }
  }
  const safeAscii = fileName.replace(/[\r\n"]/g, "_").replace(/[^\x20-\x7E]/g, "_").slice(0, 200);
  const encoded = encodeURIComponent(fileName);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileBuffer.length),
      "Content-Disposition": `attachment; filename="${safeAscii}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

async function getFilePathFromOriginal(moduleName, originalId) {
  if (!originalId) return null;
  const id = originalId.toString().trim();
  if (!id) return null;

  try {
    const mod = (moduleName || "").trim();

    if (mod === "Base Audit") {
      const doc = await StsBaseAuditReport.findById(id).lean();
      return doc?.filePath ? resolveFilePath(doc.filePath) : null;
    }
    if (mod === "New Base Setup") {
      const doc = await NewBaseSetupChecklist.findById(id).lean();
      return doc?.filePath ? resolveFilePath(doc.filePath) : null;
    }
    if (mod === "Transfer Location Questionnaire" || mod === "Transfer Location Quest") {
      const doc = await StsTransferLocationQuest.findById(id).lean();
      return doc?.filePath ? resolveFilePath(doc.filePath) : null;
    }
    if (mod === "Risk Assessment") {
      const doc = await RiskAssessment.findById(id).lean();
      if (!doc?.filePath) return null;
      const toAbs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));
      let absPath = toAbs(doc.filePath);
      if (!fs.existsSync(absPath)) {
        const alt = String(doc.filePath).replace("risk-assessment", "risk-assesment");
        const absAlt = toAbs(alt);
        if (fs.existsSync(absAlt)) absPath = absAlt;
        else return null;
      }
      return { path: absPath, name: doc.fileName || path.basename(absPath) };
    }
    if (mod === "Training") {
      const doc = await TrainingRecord.findById(id).lean();
      const fp = doc?.attachment?.filePath;
      if (!fp) return null;
      const abs = resolveFilePath(fp);
      if (abs) return { path: abs, name: doc?.attachment?.fileName };
      return null;
    }
    if (mod === "Target KPI" || mod === "KPI") {
      const doc = await KpiUpload.findById(id).lean();
      const lp = doc?.localPath;
      if (!lp) return null;
      const abs = path.isAbsolute(lp) ? (fs.existsSync(lp) ? lp : null) : resolveFilePath(lp);
      if (abs) return { path: abs, name: doc?.originalName };
      return null;
    }
    if (mod === "Equipment Defects") {
      const doc = await EquipmentDefect.findById(id).lean();
      const att = Array.isArray(doc?.attachments) && doc.attachments[0];
      if (!att) return null;
      const resolved = resolveDefectAttachmentPath(
        id,
        att.path,
        att.originalName
      );
      return resolved;
    }
  } catch (_) {}
  return null;
}

/**
 * GET /api/qhse/archive/[id]/download
 * Returns the original file when it exists. Never returns a JSON file download.
 */
export const runtime = "nodejs";

export async function GET(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const doc = await QhseArchive.findById(id).lean();
    if (!doc) {
      return NextResponse.json(
        { error: "Archive record not found" },
        { status: 404 }
      );
    }

    const meta = doc.metadata || {};
    const firstAtt = Array.isArray(meta.attachments) && meta.attachments[0];
    const rawPath =
      doc.filePath ||
      doc.metadata?.filePath ||
      doc.metadata?.localPath ||
      meta.attachment?.filePath ||
      (firstAtt && (firstAtt.filePath || firstAtt.path)) ||
      null;

    if (rawPath) {
      let absolutePath = resolveFilePath(rawPath);
      let streamName =
        firstAtt?.originalName ||
        meta?.fileName ||
        (meta?.attachment && typeof meta.attachment.originalFileName === "string"
          ? meta.attachment.originalFileName.trim()
          : null) ||
        null;
      if (!absolutePath && (doc.module || "").trim() === "Risk Assessment") {
        const toAbs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, (p || "").replace(/\\/g, "/")));
        let absPath = toAbs(rawPath);
        if (!fs.existsSync(absPath)) {
          const alt = String(rawPath).replace("risk-assessment", "risk-assesment");
          const absAlt = toAbs(alt);
          if (fs.existsSync(absAlt)) absPath = absAlt;
        }
        if (absPath && fs.existsSync(absPath)) {
          absolutePath = absPath;
          if (!streamName) streamName = meta?.fileName || path.basename(absPath);
        }
      }
      if (absolutePath) {
        return streamFile(absolutePath, streamName);
      }
      if (doc.module === "Equipment Defects" && doc.originalId && firstAtt) {
        const resolved = resolveDefectAttachmentPath(
          doc.originalId.toString(),
          firstAtt.path || firstAtt.filePath,
          firstAtt.originalName
        );
        if (resolved) return streamFile(resolved.path, resolved.name);
      }
    }

    if (doc.fileUrl && typeof doc.fileUrl === "string" && doc.fileUrl.trim()) {
      const url = doc.fileUrl.trim();
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return NextResponse.redirect(url);
      }
      const localPath = resolveFilePath(url.startsWith("/") ? url.slice(1) : url);
      if (localPath) {
        const nameOverride = pmsCertArchiveDownloadName(doc);
        return streamFile(localPath, nameOverride || undefined);
      }
    }

    const originalId = doc.originalId?.toString?.() || doc.originalId;
    const moduleName = doc.module?.trim?.() || doc.module;
    const fromOriginal = await getFilePathFromOriginal(moduleName, originalId);
    if (fromOriginal) {
      if (typeof fromOriginal === "object" && fromOriginal.path) {
        return streamFile(fromOriginal.path, fromOriginal.name || undefined);
      }
      return streamFile(fromOriginal);
    }

    return NextResponse.json(
      { error: "No file available for this archive." },
      { status: 404 }
    );
  } catch (error) {
    console.error("Archive download error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
