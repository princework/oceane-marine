import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";

const mocRiskAssessmentFileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  filename: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const MOCRiskAssessmentSchema = new mongoose.Schema(
  {
    /** Fixed form code: QAF-OFD-058A - MOC Risk Assessment */
    formCode: { type: String },
    /** Year-wise serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },
    /** Year for serial generation and list filtering */
    year: { type: Number },
    title: {
      type: String,
      trim: true,
      default: "Risk Assessment Upload",
    },
    files: {
      type: [mocRiskAssessmentFileSchema],
      required: true,
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "At least one file is required",
      },
    },
    totalSize: {
      type: Number,
      default: 0,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Total size + form code / serial number (year-wise)
MOCRiskAssessmentSchema.pre("save", async function () {
  if (this.files && this.files.length > 0) {
    this.totalSize = this.files.reduce((sum, file) => sum + (file.size || 0), 0);
  }
  if (this.isNew) {
    const year =
      this.year != null && !Number.isNaN(Number(this.year))
        ? Number(this.year)
        : new Date().getFullYear();
    if (this.year == null || Number.isNaN(Number(this.year))) {
      this.year = year;
    }
    if (!this.formCode) {
      this.formCode = "QAF-OFD-058A"; // MOC Risk Assessment form code
    }
    if (!this.serialNumber) {
      this.serialNumber = await getNextYearwiseSerial("MOC_RISK_ASSESSMENT", year);
    }
  }
});


MOCRiskAssessmentSchema.plugin(qhseArchivePlugin);
MOCRiskAssessmentSchema.plugin(qhseRevisionPlugin);

const MOCRiskAssessment =
  mongoose.models.MOCRiskAssessment ||
  mongoose.model("MOCRiskAssessment", MOCRiskAssessmentSchema);

export default MOCRiskAssessment;

