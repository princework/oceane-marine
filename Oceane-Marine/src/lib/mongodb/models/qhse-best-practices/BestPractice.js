import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const BestPracticeSchema = new mongoose.Schema(
  {
    /** Fixed form code from config (optional) */
    formCode: { type: String, index: true },
    /** Year-wise serial: YYYY-NNN (e.g. 2026-001); independent from formCode */
    serialNumber: { type: String },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    eventDate: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

BestPracticeSchema.pre("save", async function () {
  try {
    if (this.isNew) {
      // Serial year from event date (form field), not creation date
      let year = this.eventDate
        ? new Date(this.eventDate).getFullYear()
        : new Date().getFullYear();
      if (!Number.isInteger(year) || Number.isNaN(year)) {
        year = new Date().getFullYear();
      }
      if (!this.formCode) {
        this.formCode = getQhseFormCode("BEST_PRACTICE") || null;
      }
      if (!this.serialNumber) {
        this.serialNumber = await getNextYearwiseSerial("BEST_PRACTICE", year);
      }
    }
  } catch (error) {
    console.error("Best Practice Pre-Save Error:", error);
    throw error;
  }
});


BestPracticeSchema.plugin(qhseArchivePlugin);
BestPracticeSchema.plugin(qhseRevisionPlugin);

export default mongoose.models.BestPractice || mongoose.model("BestPractice", BestPracticeSchema);