import mongoose from "mongoose";

/* Reusable sub-schema for file attachments */
const fileAttachmentSchema = {
  fileUrl: { type: String, default: "" },
  originalFileName: { type: String, default: "" },
};

const poacMatrixRowSchema = new mongoose.Schema({
  stsServiceProvider: {
    type: String,
    required: true,
  },
  poacName: {
    type: String,
    required: true,
  },
  validPassport: {
    type: String,
    enum: ["Yes", "No"],
    required: true,
  },
  validPassportExpiry: { type: String, default: "" },
  validPassportFile: fileAttachmentSchema,
  /** Cron dedupe: 5-day passport expiry reminder sent for this expiry value */
  lastPassportExpiryReminder5dAt: { type: Date },
  lastPassportExpiryReminder5dExpiry: { type: String, default: "" },
  /** Cron dedupe: 1-day-after expiry notice sent for this expiry value */
  lastPassportExpiredNotice1dAt: { type: Date },
  lastPassportExpiredNotice1dExpiry: { type: String, default: "" },
  validMastersCOC: {
    type: String,
    enum: ["Yes", "No"],
    required: true,
  },
  validMastersCOCExpiry: { type: String, default: "" },
  validMastersCOCFile: fileAttachmentSchema,
  /** Cron dedupe: 5-day Master's COC expiry reminder sent for this expiry value */
  lastMastersCocExpiryReminder5dAt: { type: Date },
  lastMastersCocExpiryReminder5dExpiry: { type: String, default: "" },
  /** Cron dedupe: 1-day-after Master's COC expiry notice sent for this expiry value */
  lastMastersCocExpiredNotice1dAt: { type: Date },
  lastMastersCocExpiredNotice1dExpiry: { type: String, default: "" },
  dangerousCargoEndorsementOil: {
    type: String,
    enum: ["Yes", "No"],
    required: true,
  },
  dangerousCargoEndorsementOilExpiry: { type: String, default: "" },
  dangerousCargoEndorsementOilFile: fileAttachmentSchema,
  dangerousCargoEndorsementChem: {
    type: String,
    enum: ["Yes", "No"],
    required: true,
  },
  dangerousCargoEndorsementChemExpiry: { type: String, default: "" },
  dangerousCargoEndorsementChemFile: fileAttachmentSchema,
  dangerousCargoEndorsementGas: {
    type: String,
    enum: ["Yes", "No"],
    required: true,
  },
  dangerousCargoEndorsementGasExpiry: { type: String, default: "" },
  dangerousCargoEndorsementGasFile: fileAttachmentSchema,
  oilSpillResponseTraining: {
    type: String,
    enum: ["Yes", "No"],
    required: true,
  },
  oilSpillResponseTrainingExpiry: { type: String, default: "" },
  oilSpillResponseTrainingFile: fileAttachmentSchema,
  stsSimulatorTraining: {
    type: String,
    enum: ["Yes", "No"],
    required: true,
  },
  stsSimulatorTrainingExpiry: { type: String, default: "" },
  stsSimulatorTrainingFile: fileAttachmentSchema,
  vesselSizeLimitations: {
    type: String,
    enum: ["Yes", "No"],
    required: true,
  },
  vesselSizeLimitationsExpiry: { type: String, default: "" },
  vesselSizeLimitationsFile: fileAttachmentSchema,
  underwayOperations: {
    type: String,
    enum: ["Yes", "No"],
    required: true,
  },
  underwayOperationsExpiry: { type: String, default: "" },
  underwayOperationsFile: fileAttachmentSchema,
  validMedicals: {
    type: String,
    enum: ["Yes", "No"],
    required: true,
  },
  validMedicalsExpiry: { type: String, default: "" },
  validMedicalsFile: fileAttachmentSchema,
  /** Cron dedupe: 5-day Valid Medicals expiry reminder sent for this expiry value */
  lastMedicalsExpiryReminder5dAt: { type: Date },
  lastMedicalsExpiryReminder5dExpiry: { type: String, default: "" },
  /** Cron dedupe: 1-day-after Valid Medicals expiry notice sent for this expiry value */
  lastMedicalsExpiredNotice1dAt: { type: Date },
  lastMedicalsExpiredNotice1dExpiry: { type: String, default: "" },
  experienceWithOceane: {
    type: String,
    required: true,
  },
  visaEntries: {
    type: [
      {
        _id: false,
        location: { type: String, required: true },
        validity: { type: String, default: "" },
      },
    ],
    default: [],
  },
  remarks: {
    type: String,
    default: "",
  },
  /* Multi-file attachments (array of { fileUrl, originalFileName }) */
  attachments: {
    type: [
      {
        fileUrl: { type: String, default: "" },
        originalFileName: { type: String, default: "" },
      },
    ],
    default: [],
  },
  /* Legacy single attachment field — kept for backward compatibility */
  attachment: {
    fileUrl: {
      type: String,
      default: "",
    },
    originalFileName: String,
  },
});

const poacMatrixSchema = new mongoose.Schema(
  {
    rows: {
      type: [poacMatrixRowSchema],
      required: true,
      default: [],
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  { timestamps: true }
);

// Delete cached model to ensure schema changes are picked up during hot reload
if (mongoose.models.PoacMatrix) {
  delete mongoose.models.PoacMatrix;
}

export default mongoose.model("PoacMatrix", poacMatrixSchema);
