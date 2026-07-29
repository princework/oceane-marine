import QhseArchive from "@/lib/mongodb/models/qhse-archive/QhseArchive";

/** QHSE Archive → Module filter */
export const PMS_PRIMARY_EQUIPMENT_CERT_ARCHIVE_MODULE =
  "PMS Primary Equipment Certificates";

export const PMS_ACCESSORIES_CERT_ARCHIVE_MODULE =
  "PMS Accessories Certificates";

function snapshotDoc(doc) {
  const raw = doc?.toObject?.() ? doc.toObject() : doc;
  if (!raw || typeof raw !== "object") return {};
  try {
    return JSON.parse(JSON.stringify(raw));
  } catch {
    return { ...raw };
  }
}

function buildTitle(snap, inventoryKind) {
  if (inventoryKind === "accessories") {
    const id =
      (typeof snap.equipmentNo === "string" && snap.equipmentNo.trim()) ||
      (typeof snap.equipmentName === "string" && snap.equipmentName.trim()) ||
      "Accessory";
    return `${id} · Certificates`.replace(/\s+/g, " ").trim();
  }
  const parts = [
    snap.equipmentCode || "Equipment",
    snap.serialCode ? `· ${snap.serialCode}` : "",
    "· Certificates",
  ];
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function buildFormCode(snap, inventoryKind) {
  if (inventoryKind === "accessories") {
    if (typeof snap.equipmentNo === "string" && snap.equipmentNo.trim()) {
      return snap.equipmentNo.trim();
    }
    return typeof snap.equipmentName === "string"
      ? snap.equipmentName.trim()
      : "";
  }
  return snap.equipmentCode ? String(snap.equipmentCode).trim() : "";
}

function listSerialForArchiveTable(snap, inventoryKind) {
  if (inventoryKind === "accessories") {
    return typeof snap.equipmentNo === "string" ? snap.equipmentNo.trim() : "";
  }
  return snap.serialCode || "";
}

/**
 * @param {object} options
 * @param {import("mongoose").Document|object} options.doc
 * @param {string} options.moduleLabel
 * @param {"primary_equipment"|"accessories"} options.inventoryKind
 * @param {string} options.archiveReason
 * @param {"manual"|"replace_on_save"} options.triggeredBy
 * @param {boolean} [options.replacedManufacturing]
 * @param {boolean} [options.replacedTest]
 * @param {"both"|"manufacturing"|"test"} [options.scope] - manual single-cert vs full row
 */
export async function createPmsInventoryCertificateArchiveEntry({
  doc,
  moduleLabel,
  inventoryKind,
  archiveReason,
  triggeredBy,
  replacedManufacturing = false,
  replacedTest = false,
  scope = "both",
}) {
  const snap = snapshotDoc(doc);
  const archivedAt = new Date();
  const m = snap.manufacturingCertificate || {};
  const t = snap.testCertificate || {};
  const mUrl = typeof m.fileUrl === "string" ? m.fileUrl.trim() : "";
  const tUrl = typeof t.fileUrl === "string" ? t.fileUrl.trim() : "";

  if (scope === "manufacturing" && !mUrl) {
    throw new Error("No manufacturing certificate on file to archive.");
  }
  if (scope === "test" && !tUrl) {
    throw new Error("No test certificate on file to archive.");
  }
  if (scope === "both" && !mUrl && !tUrl) {
    throw new Error("No certificate on file to archive.");
  }

  let fileUrl = "";
  if (scope === "manufacturing") fileUrl = mUrl;
  else if (scope === "test") fileUrl = tUrl;
  else fileUrl = mUrl || tUrl || "";

  const title = buildTitle(snap, inventoryKind);
  const formCode = buildFormCode(snap, inventoryKind);

  const metadata = {
    serialNumber: listSerialForArchiveTable(snap, inventoryKind),
    inventoryKind,
    scope,
    archiveReason,
    triggeredBy,
    archivedAtIso: archivedAt.toISOString(),
    replacedManufacturing,
    replacedTest,
    manufacturingCertificate: {
      fileUrl: mUrl,
      originalFileName: m.originalFileName || "",
    },
    testCertificate: {
      fileUrl: tUrl,
      originalFileName: t.originalFileName || "",
    },
    inventorySnapshot: snap,
  };

  return QhseArchive.create({
    year: archivedAt.getFullYear(),
    module: moduleLabel,
    documentType: moduleLabel,
    formCode,
    title,
    filePath: "",
    fileUrl,
    originalId: snap._id ? String(snap._id) : "",
    metadata,
    archivedAt,
  });
}
