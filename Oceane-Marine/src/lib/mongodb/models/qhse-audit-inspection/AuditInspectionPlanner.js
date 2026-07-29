import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const RowSchema = new mongoose.Schema(
  {
    rowId: { type: String, required: true },
    description: String,
    frequency: String,
    dueBy: String,
    status: String,
    auditorName: String,
    auditDate: Date,
    remarks: String,

    fileUrl: String,
    fileName: String,
    fileUploadedAt: Date,
  },
  { _id: false }
);

/* =========================
   Category
========================= */
const CategorySchema = new mongoose.Schema(
  {
    key: String,
    title: String,
    rows: [RowSchema],
  },
  { _id: false }
);

/* =========================
   Main Form
========================= */
const AuditInspectionPlannerSchema = new mongoose.Schema(
  {
    /** Fixed form code (e.g. QAF-OFD-048) */
    formCode: { type: String },
    /** Year for serial (e.g. 2026); used when generating serialNumber */
    year: { type: Number },
    /** Year-wise serial: YYYY-NNN (e.g. 2026-001); independent from formCode */
    serialNumber: { type: String },
    version: { type: String, required: true },
    issueDate: { type: Date, required: true },
    approvedBy: { type: String, required: true },

    status: {
      type: String,
      enum: ["Draft", "Submitted", "Approved"],
      default: "Draft",
    },

    categories: { type: [CategorySchema], required: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

AuditInspectionPlannerSchema.pre("save", async function () {
  if (this.isNew) {
    if (!this.formCode) {
      this.formCode = getQhseFormCode("AUDIT_INSPECTION_PLANNER") || null;
    }
    if (!this.serialNumber) {
      const year = this.year != null && !Number.isNaN(Number(this.year)) ? Number(this.year) : undefined;
      this.serialNumber = await getNextYearwiseSerial("AUDIT_INSPECTION_PLANNER", year);
    }
  }
});


AuditInspectionPlannerSchema.plugin(qhseArchivePlugin);
AuditInspectionPlannerSchema.plugin(qhseRevisionPlugin);

export default mongoose.models.AuditInspectionPlanner ||
  mongoose.model("AuditInspectionPlanner", AuditInspectionPlannerSchema);
