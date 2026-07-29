import mongoose from "mongoose";

/** Office check keys: JPO, Risk Assessment, STS Transfer Location Checklist, etc. */
const OFFICE_CHECK_KEYS = [
  "jpo",
  "riskAssessment",
  "stsTransferLocationChecklist",
  "stsNewBaseChecklist",
  "moc",
  "mocRa",
  "preArrivalNotification",
  "contingencyPlan",
  "costing",
];

const checkboxAttachmentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    filePath: { type: String, required: true },
    fileName: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const additionalAttachmentSchema = new mongoose.Schema(
  {
    filePath: { type: String, required: true },
    fileName: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const officeChecksSchema = new mongoose.Schema(
  {
    jpo: { type: Boolean, default: false },
    riskAssessment: { type: Boolean, default: false },
    stsTransferLocationChecklist: { type: Boolean, default: false },
    stsNewBaseChecklist: { type: Boolean, default: false },
    moc: { type: Boolean, default: false },
    mocRa: { type: Boolean, default: false },
    preArrivalNotification: { type: Boolean, default: false },
    contingencyPlan: { type: Boolean, default: false },
    costing: { type: Boolean, default: false },
  },
  { _id: false }
);

const LocationOfficeCheckSchema = new mongoose.Schema(
  {
    formCode: { type: String, sparse: true },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    locationName: { type: String, required: true },
    year: { type: Number, required: true },
    officeChecks: { type: officeChecksSchema, default: () => ({}) },
    checkboxAttachments: { type: [checkboxAttachmentSchema], default: [] },
    additionalAttachments: { type: [additionalAttachmentSchema], default: [] },
    lastUploaded: { type: Date, default: Date.now },
    uploadedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String },
    },
  },
  { timestamps: true }
);

LocationOfficeCheckSchema.index({ locationId: 1, year: 1 }, { unique: true });

export const OFFICE_CHECK_KEYS_EXPORT = OFFICE_CHECK_KEYS;
export default mongoose.models.LocationOfficeCheck ||
  mongoose.model("LocationOfficeCheck", LocationOfficeCheckSchema);
