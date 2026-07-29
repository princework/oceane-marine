import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const getQuarterFromDate = (date) => {
  const d = new Date(date);
  const m = d.getMonth(); // 0-11
  return QUARTERS[Math.floor(m / 3)];
};

/* ----------------------------------------
   QUARTERLY PLAN SUB-SCHEMA
----------------------------------------- */
const QuarterlyDrillSchema = new mongoose.Schema(
  {
    plannedDate: { type: Date, required: true },
    quarter: { type: String, enum: QUARTERS, index: true },
    topic: { type: String, required: true, trim: true },
    instructor: { type: String, trim: true },
    description: { type: String, trim: true },
    status: { type: String, enum: ["Draft", "Approved"], default: "Draft", index: true },
  },
  { _id: true } // keep subdoc ids so we can reference a specific plan item
);

/* ----------------------------------------
   QUARTER FILE SCHEMA
----------------------------------------- */
const QuarterFileSchema = new mongoose.Schema(
  {
    filePath: {
      type: String,
    },
    fileName: {
      type: String,
    },
  },
  { _id: false }
);

/* ----------------------------------------
   DRILL PLAN (ANNUAL MATRIX)
----------------------------------------- */
const DrillPlanSchema = new mongoose.Schema(
  {
    /** Fixed form code for drill plan (e.g. QAF-OFD-040) */
    formCode: {
      type: String,
      index: true,
    },

    /** Year-wise serial: YYYY-NNN (e.g. 2026-001, 2026-002) */
    serialNumber: { type: String },

    // Year for the drill plan
    year: {
      type: Number,
      required: true,
      index: true,
    },

    planItems: {
      type: [QuarterlyDrillSchema],
    },

    quarterFiles: {
      Q1: { type: QuarterFileSchema, default: null },
      Q2: { type: QuarterFileSchema, default: null },
      Q3: { type: QuarterFileSchema, default: null },
      Q4: { type: QuarterFileSchema, default: null },
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

/* ----------------------------------------
   PRE-SAVE: fixed form code + year-wise serial
----------------------------------------- */
DrillPlanSchema.pre("save", async function () {
  if (this.isNew) {
    if (!this.formCode) {
      this.formCode = getQhseFormCode("DRILL_PLAN") || null;
    }
    if (!this.serialNumber) {
      this.serialNumber = await getNextYearwiseSerial("DRILL_PLAN");
    }
  }
});

DrillPlanSchema.pre("validate", function () {
  if (Array.isArray(this.planItems)) {
    this.planItems = this.planItems.map((item) => ({
      ...item,
      quarter: item.quarter || getQuarterFromDate(item.plannedDate),
      status: item.status || "Draft",
    }));
  }
});


DrillPlanSchema.plugin(qhseArchivePlugin);

// Ensure the model is properly exported
const DrillPlan = mongoose.models.DrillPlan || mongoose.model("DrillPlan", DrillPlanSchema);

export default DrillPlan;