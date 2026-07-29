import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

/* ----------------------------------------
   PARTICIPANT SUB-SCHEMA
----------------------------------------- */
const ParticipantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    role: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

/* ----------------------------------------
   DRILL REPORT SCHEMA
----------------------------------------- */
const DrillReportSchema = new mongoose.Schema(
  {
    /** Fixed form code from config (e.g. QAF-OFD-xxx for drill report) */
    formCode: { type: String, index: true },

    /** Year-wise serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },

    drillNo: {
      type: String,
      required: true,
      trim: true,
    },

    drillDate: {
      type: Date,
      required: true,
    },

    location: {
      type: String,
      trim: true,
    },

    drillScenario: {
      type: String,
      required: true,
      trim: true,
    },

    participants: {
      type: [ParticipantSchema],
      required: true,
    },

    incidentProgression: {
      type: String,
      trim: true,
    },

    year: {
      type: Number,
      index: true,
    },

    quarter: {
      type: String,
      enum: ["Q1", "Q2", "Q3", "Q4"],
      index: true,
    },

    status: {
      type: String,
      enum: ["Draft", "Completed"],
      default: "Draft",
      index: true,
    },

    completedAt: {
      type: Date,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    /** Revision: 1.0 = new; 1.1, 1.2, ... on update. */
    revNo: { type: String, default: "1.0" },

    /** Date the form was issued / last revised */
    issueDate: { type: Date },

    /** Display name / initials of approver (for PDF/Word header) */
    approvedByName: { type: String, trim: true },
  },
  { timestamps: true }
);

DrillReportSchema.pre("save", async function () {
  if (this.isNew) {
    if (!this.formCode) {
      this.formCode = getQhseFormCode("DRILL_REPORT") || null;
    }
    if (!this.serialNumber) {
      this.serialNumber = await getNextYearwiseSerial("DRILL_REPORT");
    }
    if (!this.revNo) {
      this.revNo = "1.0";
    }
    if (!this.issueDate) {
      this.issueDate = new Date();
    }
  }
});


DrillReportSchema.plugin(qhseArchivePlugin);

export default mongoose.models.DrillReport ||
  mongoose.model("DrillReport", DrillReportSchema);