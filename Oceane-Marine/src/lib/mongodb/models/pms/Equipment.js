import mongoose from "mongoose";

const fileAttachmentSchema = {
  fileUrl: { type: String, default: "" },
  originalFileName: { type: String, default: "" },
};

const equipmentSchema = new mongoose.Schema(
  {
    /** User-defined code; not unique — multiple physical units may share the same code; use serialCode for a unique instance id */
    equipmentCode: { type: String, required: true, trim: true },
    /** Year-wise instance id (e.g. 2026-001); auto-assigned on create; distinct from equipmentCode */
    serialCode: { type: String, unique: true, sparse: true, trim: true },
    equipmentName: { type: String, required: true },
    equipmentType: { type: String, trim: true, default: "" },

    specification: String,
    manufacturer: String,
    yearOfManufacturing: Number,

    ownershipType: {
      type: String,
      enum: ["OWNED", "THIRD_PARTY"],
      required: true
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "RETIRED"],
      default: "ACTIVE"
    },

    isInUse: { type: Boolean, default: false },

    /** Physical placement — multi-select (at least one required on create) */
    placedInOffice: { type: Boolean, default: false },
    placedInBase: { type: Boolean, default: false },
    placedInBay: { type: Boolean, default: false },

    /** Free text (e.g. company / cost centre) */
    entity: { type: String, trim: true, default: "" },
    /** Label from PMS → Location master (dropdown) */
    locationName: { type: String, trim: true, default: "" },

    dateOfPurchase: Date,
    firstUseDate: Date,

    lastTestDate: Date,
    nextTestDate: Date,

    retirementPeriodYears: { type: Number, default: 10 },
    dateToBeRetired: Date,
    manufacturingCertificate: fileAttachmentSchema,
    testCertificate: fileAttachmentSchema,
    remarks: String,

    /** Cron dedupe: 30-day-prior testing email already sent for this `nextTestDate` (UTC day) */
    pmsTestReminder30dSentForNextTestDate: Date,

    /** Cron dedupe: 15-day-prior testing email already sent for this `nextTestDate` (UTC day) */
    pmsTestReminder15dSentForNextTestDate: Date
  },
  { timestamps: true }
);


/** Drop cached model so schema changes (e.g. serialCode) apply — avoids silent strip in strict mode during HMR / long-running dev servers */
if (mongoose.models.Equipment) {
  mongoose.deleteModel("Equipment");
}

export default mongoose.model("Equipment", equipmentSchema);
