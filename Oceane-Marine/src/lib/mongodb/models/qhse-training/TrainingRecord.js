import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const AttendanceSchema = new mongoose.Schema(
  {
    traineeName: {
      type: String,
      required: true,
      trim: true,
    },

    department: {
      type: String,
      trim: true,
    },

    designation: {
      type: String,
      trim: true,
    },

    signature: {
      type: String, 
    },
  },
  { _id: false }
);

/* ----------------------------------------
   TRAINING RECORD (EXECUTION)
----------------------------------------- */
const TrainingRecordSchema = new mongoose.Schema(
  {
    /** Fixed form code (e.g. QAF-OFD-039) */
    formCode: { type: String, index: true },

    /** Year-wise serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },

    trainingPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainingPlan",
      required: true,
      index: true,
    },

    plannedDate: {
      type: Date,
      required: true,
    },

    topic: {
      type: String,
      required: true,
    },

    instructor: {
      type: String,
      required: true,
    },

    actualTrainingDate: {
      type: Date,
      required: true,
    },

    attendance: {
      type: [AttendanceSchema],
      required: true,
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

    recommendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    attachment: {
      filePath: {
        type: String,
      },
      fileName: {
        type: String,
      },
    },
  },
  { timestamps: true }
);

TrainingRecordSchema.pre("save", async function () {
  if (this.isNew) {
    if (!this.formCode) {
      this.formCode = getQhseFormCode("TRAINING_RECORD") || null;
    }
    if (!this.serialNumber) {
      this.serialNumber = await getNextYearwiseSerial("TRAINING_RECORD");
    }
  }
});


TrainingRecordSchema.plugin(qhseArchivePlugin);
TrainingRecordSchema.plugin(qhseRevisionPlugin);

export default mongoose.models.TrainingRecord ||
  mongoose.model("TrainingRecord", TrainingRecordSchema);
