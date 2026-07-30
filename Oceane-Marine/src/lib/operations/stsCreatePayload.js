import mongoose from "mongoose";

const OPERATION_TYPE_VALUES = ["underway", "At Anchor"];
const FLOW_DIRECTION_VALUES = ["left", "right", "both"];
const OPERATION_STATUS_VALUES = ["DRAFT", "INPROGRESS", "COMPLETED", "CANCELED", "Lined Up"];
const VESSEL_TYPE_VALUES = [
  "VLCC",
  "ULCC",
  "Suexmax",
  "Aframax",
  "panamax",
  "post-panamax",
  "Handysize",
  "Capezie",
  "Supramax",
];

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === "" || s === "Select" ? null : s;
}

function objectIdOrNull(value) {
  const s = trimOrNull(value);
  if (!s || !mongoose.Types.ObjectId.isValid(s)) return null;
  return s;
}

/** Form sends equipment IDs; schema expects embedded { equipment, startTime, status }. */
export function normalizeEquipmentUsage(usage, operationStartTime) {
  const start = operationStartTime instanceof Date ? operationStartTime : new Date();
  if (!Array.isArray(usage)) return [];

  return usage
    .map((item) => {
      if (typeof item === "string") {
        const id = objectIdOrNull(item);
        if (!id) return null;
        return {
          equipment: new mongoose.Types.ObjectId(id),
          startTime: start,
          status: "IN_USE",
        };
      }
      if (item && typeof item === "object") {
        const id = objectIdOrNull(item.equipment);
        if (!id) return null;
        return {
          equipment: new mongoose.Types.ObjectId(id),
          startTime: item.startTime ? new Date(item.startTime) : start,
          status: item.status === "RELEASED" ? "RELEASED" : "IN_USE",
        };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Build a Mongoose-safe STS create document from multipart text fields.
 * Draft saves allow partial data; final submit requires location.
 */
export function buildStsCreateDocument({
  body,
  uploadedFiles = {},
  equipmentUsage = [],
  manualDocumentationEntries = [],
  parentOperationId,
  operationStartTime,
  operationEndTime,
}) {
  const isSubmitted = body.isSubmitted === "true" || body.isSubmitted === true;
  const operationRef = trimOrNull(body.Operation_Ref_No);

  if (!operationRef) {
    const err = new Error("Operation reference number is required. Enter one manually or click ⚡ to generate.");
    err.statusCode = 400;
    throw err;
  }

  const locationId = objectIdOrNull(body.location);
  if (isSubmitted && !locationId) {
    const err = new Error("Location is required before submitting the operation.");
    err.statusCode = 400;
    throw err;
  }

  const operationType = trimOrNull(body.operationType);
  if (operationType && !OPERATION_TYPE_VALUES.includes(operationType)) {
    const err = new Error("Invalid operation type.");
    err.statusCode = 400;
    throw err;
  }

  const operationStatus = OPERATION_STATUS_VALUES.includes(body.operationStatus)
    ? body.operationStatus
    : "INPROGRESS";

  const flowDirection = FLOW_DIRECTION_VALUES.includes(body.flowDirection)
    ? body.flowDirection
    : "left";

  const doc = {
    Operation_Ref_No: operationRef,
    parentOperationId,
    version: 1,
    isLatest: true,
    operationStatus,
    isSubmitted,
    submittedAt:
      isSubmitted && body.submittedAt ? new Date(body.submittedAt) : null,
    operationStartTime,
    operationEndTime,
    flowDirection,
    documents: manualDocumentationEntries,
    ...uploadedFiles,
    equipments: normalizeEquipmentUsage(equipmentUsage, operationStartTime),
  };

  if (locationId) doc.location = locationId;
  if (operationType) doc.operationType = operationType;

  const mooringMasterId = objectIdOrNull(body.mooringMaster);
  if (mooringMasterId) doc.mooringMaster = mooringMasterId;

  const cargoId = objectIdOrNull(body.typeOfCargo);
  if (cargoId) doc.typeOfCargo = cargoId;

  const optionalText = [
    "typeOfOperation",
    "client",
    "agent",
    "loaCHS",
    "loaMS",
    "chs",
    "ms",
    "remarks",
  ];
  for (const key of optionalText) {
    const v = trimOrNull(body[key]);
    if (v) doc[key] = v;
  }

  const vesselTypeCHS = trimOrNull(body.vesselTypeCHS);
  if (vesselTypeCHS && VESSEL_TYPE_VALUES.includes(vesselTypeCHS)) {
    doc.vesselTypeCHS = vesselTypeCHS;
  }

  const vesselTypeMS = trimOrNull(body.vesselTypeMS);
  if (vesselTypeMS && VESSEL_TYPE_VALUES.includes(vesselTypeMS)) {
    doc.vesselTypeMS = vesselTypeMS;
  }

  const qty = trimOrNull(body.quantity);
  if (qty && !Number.isNaN(Number(qty))) {
    doc.quantity = Number(qty);
  }

  return doc;
}
