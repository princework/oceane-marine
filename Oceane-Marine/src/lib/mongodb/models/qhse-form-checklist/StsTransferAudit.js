import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const YesNoNA = {
  type: String,
  enum: ["Yes", "No", "NA"],
  // required: true,
};

const QuestionSchema = new mongoose.Schema(
  {
    qNo: String,
    question: String,
    answer: YesNoNA,
    remarks: String,
  },
  { _id: false }
);

const STSTransferAuditSchema = new mongoose.Schema(
  {
    /** Fixed form code (e.g. QAF-OFD-003) */
    formCode: { type: String },

    /** Year-wise document serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },

    version: {
      type: String,
      default: "1.0",
    },

    revisionDate: {
      type: Date,
    },

    approvedBy: {
      type: String,
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    header: {
      locationName: String,
      date: Date,
      jobNo: String,
      dischargingVessel: String,
      receivingVessel: String,
    },

    /* =========================
       SECTION A – PRE-PLANNING
    ========================== */
    sectionA_PrePlanning: [QuestionSchema],

    /* =========================
       SECTION B – MOB → DEMOB
    ========================== */
    sectionB_MobilizationToDemobilization: [QuestionSchema],

    /* =========================
       SECTION C – SUPPORT CRAFT
    ========================== */
    sectionC_SupportCraft: [QuestionSchema],

    /* =========================
       SECTION D – STS EQUIPMENT
    ========================== */
    sectionD_STSEquipment: [QuestionSchema],

    /* =========================
       SECTION E – POST OPERATION
    ========================== */
    sectionE_PostOperation: [QuestionSchema],

    /* =========================
       COMMENTS
    ========================== */
    comments: {
      remarks: String,
    },

    completedBy: {
      name: String,
      date: Date,
      signatureUrl: String,
      signatureText: String,
      signaturePhoto: String, // base64 data URL
    },

    versionHistory: [
      {
        version: Number,
        submittedAt: Date,
        submittedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        snapshot: mongoose.Schema.Types.Mixed,
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

STSTransferAuditSchema.pre("save", async function () {
  try {
    if (this.isNew) {
      if (!this.formCode) {
        this.formCode = getQhseFormCode("STS_TRANSFER_AUDIT") || null;
      }
      if (!this.serialNumber) {
        this.serialNumber = await getNextYearwiseSerial("STS_TRANSFER_AUDIT");
      }
    }
  } catch (error) {
    console.error("STS Transfer Audit Pre-Save Error:", error);
    throw error;
  }
});


STSTransferAuditSchema.plugin(qhseArchivePlugin);
STSTransferAuditSchema.plugin(qhseRevisionPlugin);

export default mongoose.models.STSTransferAudit ||
  mongoose.model("STSTransferAudit", STSTransferAuditSchema);
