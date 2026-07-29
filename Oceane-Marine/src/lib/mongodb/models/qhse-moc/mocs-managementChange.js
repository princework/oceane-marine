import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

/* =========================
   COUNTER SCHEMA
========================= */
// Dedicated counter schema for MOC Management Change (avoid collisions)
const MOCManagementCounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    year: { type: Number },
    seq: { type: Number, default: 0 },
  },
  { strict: true }
);

// Use a unique model name so it doesn't clash with other counters
const MOCManagementCounter =
  mongoose.models.MOCManagementCounter ||
  mongoose.model("MOCManagementCounter", MOCManagementCounterSchema);

// Sub-schema for risk assessment files attached to an MOC
const mocRiskAssessmentFileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    filename: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/* =========================
   MOC MANAGEMENT CHANGE SCHEMA
========================= */
const MOCSchemaManagementChange = new mongoose.Schema(
  {
    /** Fixed form code (e.g. QAF-OFD-058) */
    formCode: { type: String },

    /** Year-wise serial: YYYY-NNN (e.g. 2026-001); independent from formCode */
    serialNumber: { type: String },

    /** Year selected on form; used for serial and MOC number */
    year: { type: Number },

    mocNumber: {
      type: String,
      unique: true,
    },

    proposedChange: {
      type: String,
      required: function () {
        // Required once form is moved out of Draft into active review (Open)
        return this.status === "Open";
      },
      trim: true,
    },

    reasonForChange: {
      type: String,
      required: function () {
        return this.status === "Open";
      },
      trim: true,
    },

    proposedBy: {
      type: String,
      required: function () {
        return this.status === "Open";
      },
    },

    mocInitiatedBy: {
      type: String,
      required: function () {
        return this.status === "Open";
      },
    },

    initiationDate: {
      type: Date,
      default: Date.now,
    },

    targetImplementationDate: Date,

    potentialConsequences: {
      environment: { type: Boolean, default: false },
      safety: { type: Boolean, default: false },
      contractual: { type: Boolean, default: false },
      cost: { type: Boolean, default: false },
      operational: { type: Boolean, default: false },
      reputation: { type: Boolean, default: false },
      remarks: String,
    },

    equipmentFacilityDocumentationAffected: String,

    riskAssessmentRequired: {
      type: Boolean,
      default: false,
    },

    riskLevel: {
      type: String,
      enum: ["Low", "Medium", "High"],
    },

    reviewerComments: String,
    rejectionReason: String,

    changeMadeBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    changeDetails: String,
    changeCompletionDate: Date,

    trainingRequired: {
      type: Boolean,
      default: false,
    },

    trainingDetails: String,
    trainingCompleted: {
      type: Boolean,
      default: false,
    },
    trainingCompletionDate: Date,

    documentChangeRequired: {
      type: Boolean,
      default: false,
    },

    dcrNumber: String,

    status: {
      type: String,
      enum: ["Draft", "Open", "Closed"],
      default: "Draft",
    },
    statusReview: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Closed"],
      default: "Pending",
    },

    /** Risk assessment documents (when riskAssessmentRequired is true) */
    riskAssessmentFiles: {
      type: [mocRiskAssessmentFileSchema],
      default: [],
    },
  },
  { timestamps: true }
);

MOCSchemaManagementChange.pre("save", async function () {
  try {
    if (!this.isNew) return;

    const year =
      this.year != null && !Number.isNaN(Number(this.year))
        ? Number(this.year)
        : new Date().getFullYear();
    // Persist so list can filter by it
    if (this.year == null || Number.isNaN(Number(this.year))) {
      this.year = year;
    }

    if (!this.formCode) {
      this.formCode = getQhseFormCode("MOC_MANAGEMENT_CHANGE") || null;
    }
    if (!this.serialNumber) {
      this.serialNumber = await getNextYearwiseSerial("MOC_MANAGEMENT_CHANGE", year);
    }
    if (!this.mocNumber) {
      const mocCounter = await MOCManagementCounter.findOneAndUpdate(
        { key: "MOC_NUMBER", year },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, strict: false }
      );
      this.mocNumber = `MOC-${year}-${String(mocCounter.seq).padStart(3, "0")}`;
    }
  } catch (error) {
    console.error("MOC Management Change Pre-Save Error:", error);
    throw error;
  }
});


MOCSchemaManagementChange.plugin(qhseArchivePlugin);
MOCSchemaManagementChange.plugin(qhseRevisionPlugin);

export default mongoose.models.MOCManagementChange ||
  mongoose.model("MOCManagementChange", MOCSchemaManagementChange);
