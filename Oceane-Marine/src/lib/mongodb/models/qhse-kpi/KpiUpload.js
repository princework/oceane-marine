import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const KpiUploadSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true, trim: true },
    publicId: { type: String, required: false }, // optional when storing locally
    url: { type: String, required: true },
    localPath: { type: String }, // local filesystem path (relative)
    size: { type: Number, required: true },
    mimeType: { type: String },
    year: { type: Number, index: true },
    /** Fixed form code from config (optional) */
    formCode: { type: String },
    /** Year-wise serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

KpiUploadSchema.pre("save", async function () {
  try {
    if (this.isNew) {
      if (!this.formCode) {
        this.formCode = getQhseFormCode("KPI_UPLOAD") || null;
      }
      if (!this.serialNumber) {
        const year = this.year != null && !Number.isNaN(Number(this.year))
          ? Number(this.year)
          : undefined;
        this.serialNumber = await getNextYearwiseSerial("KPI_UPLOAD", year);
      }
    }
  } catch (error) {
    console.error("KpiUpload pre-save error:", error);
    throw error;
  }
});


KpiUploadSchema.plugin(qhseArchivePlugin);
KpiUploadSchema.plugin(qhseRevisionPlugin);

const KpiUpload =
  mongoose.models.KpiUpload || mongoose.model("KpiUpload", KpiUploadSchema);

export default KpiUpload;


