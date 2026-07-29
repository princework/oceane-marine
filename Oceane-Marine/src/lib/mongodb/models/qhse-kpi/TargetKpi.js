import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const KpiRowSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    targetForYear: { type: Number, default: 0 },
    quarter1: { type: Number, default: 0 },
    quarter2: { type: Number, default: 0 },
    quarter3: { type: Number, default: 0 },
    quarter4: { type: Number, default: 0 },
    targetsAchieved: { type: Number, default: 0 },
  },
  { _id: false }
);

const TargetKpiSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, index: true },
    /** Fixed form code from config (optional) */
    formCode: { type: String },
    /** Year-wise document serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },
    rows: {
      type: [KpiRowSchema],
      default: [],
    },
  },
  { timestamps: true }
);

TargetKpiSchema.pre("save", async function () {
  try {
    if (this.isNew) {
      if (!this.formCode) {
        this.formCode = getQhseFormCode("TARGET_KPI") || null;
      }
      if (!this.serialNumber) {
        const year = this.year != null && !Number.isNaN(Number(this.year))
          ? Number(this.year)
          : undefined;
        this.serialNumber = await getNextYearwiseSerial("TARGET_KPI", year);
      }
    }
  } catch (error) {
    console.error("TargetKpi pre-save error:", error);
    throw error;
  }
});


TargetKpiSchema.plugin(qhseArchivePlugin);
TargetKpiSchema.plugin(qhseRevisionPlugin);

export default mongoose.models.TargetKpi ||
  mongoose.model("TargetKpi", TargetKpiSchema);
