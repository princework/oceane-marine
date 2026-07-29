import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const RiskAssessmentSchema = new mongoose.Schema(
  {
    /** Fixed form code (e.g. QAF-OFD-006) */
    formCode: { type: String },
    /** Year-wise serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },
    locationName: { type: String, required: true, trim: true },
    /** Date/year of the risk assessment */
    assessmentDate: { type: Date },
    version: { type: String, required: true, trim: true },
    filePath: { type: String, required: true }, // relative path on disk
    fileName: { type: String, required: true }, // original filename
    mimeType: { type: String },
    fileSize: { type: Number },
  },
  { timestamps: true }
);

RiskAssessmentSchema.pre("save", async function () {
  if (this.isNew) {
    if (!this.formCode) {
      this.formCode = getQhseFormCode("RISK_ASSESSMENT") || null;
    }
    if (!this.serialNumber) {
      const year = this.assessmentDate
        ? new Date(this.assessmentDate).getFullYear()
        : undefined;
      this.serialNumber = await getNextYearwiseSerial("RISK_ASSESSMENT", year);
    }
  }
});


RiskAssessmentSchema.plugin(qhseArchivePlugin);
RiskAssessmentSchema.plugin(qhseRevisionPlugin);

export default mongoose.models.RiskAssessment ||
  mongoose.model("RiskAssessment", RiskAssessmentSchema);