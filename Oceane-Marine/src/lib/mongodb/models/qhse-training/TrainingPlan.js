import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";

const MonthlyTrainingSchema = new mongoose.Schema(
  {
    plannedDate: {
      type: Date,
      required: true,
    },

    topic: {
      type: String,
      required: true,
      trim: true,
    },

    instructor: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const MonthPairFileSchema = new mongoose.Schema(
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

const TrainingPlanSchema = new mongoose.Schema(
  {
    /** Fixed form code for training plan / matrix (e.g. QAF-OFD-038) */
    formCode: {
      type: String,
      index: true,
    },

    /** Year-wise serial: YYYY-NNN (e.g. 2026-001, 2026-002) */
    serialNumber: { type: String },

    year: {
      type: Number,
      index: true,
    },

    planItems: {
      type: [MonthlyTrainingSchema],
    },

    monthPairFiles: {
      "Jan-Feb": { type: MonthPairFileSchema, default: null },
      "Mar-Apr": { type: MonthPairFileSchema, default: null },
      "May-Jun": { type: MonthPairFileSchema, default: null },
      "Jul-Aug": { type: MonthPairFileSchema, default: null },
      "Sep-Oct": { type: MonthPairFileSchema, default: null },
      "Nov-Dec": { type: MonthPairFileSchema, default: null },
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    rejectedAt: {
      type: Date,
    },

    /** Editor who created/last resubmitted this plan (used to resume their draft and to know who to notify). */
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    status: {
      type: String,
      enum: ["Draft", "Pending Approval", "Approved", "Rejected"],
      default: "Draft",
      index: true,
    },
  },
  { timestamps: true }
);

/* ----------------------------------------
   PRE-VALIDATE HOOK (runs before validation)
----------------------------------------- */
TrainingPlanSchema.pre("validate", async function () {
  // Set year from planItems before validation
  if (this.planItems?.length > 0) {
    const firstDate = new Date(this.planItems[0].plannedDate);
    this.year = firstDate.getFullYear();
  }
});

/* ----------------------------------------
   PRE-SAVE: fixed form code + year-wise serial
----------------------------------------- */
TrainingPlanSchema.pre("save", async function () {
  if (this.isNew) {
    if (!this.formCode) {
      this.formCode = getQhseFormCode("TRAINING_PLAN") || null;
    }
    if (!this.serialNumber) {
      this.serialNumber = await getNextYearwiseSerial("TRAINING_PLAN");
    }
  }
});


TrainingPlanSchema.plugin(qhseArchivePlugin);

export default mongoose.models.TrainingPlan ||
  mongoose.model("TrainingPlan", TrainingPlanSchema);
