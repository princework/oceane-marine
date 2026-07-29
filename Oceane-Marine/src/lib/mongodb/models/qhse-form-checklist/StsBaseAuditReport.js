import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const STSBaseAuditReportSchema = new mongoose.Schema(
  {
    /** Fixed form code (e.g. QAF-OFD-004) */
    formCode: { type: String },

    /** Year-wise document serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },

    description: {
      type: String,
    },

    filePath: {
      type: String,
      required: true,
    },

    version: {
      type: String,
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    location: {
      locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
      name: { type: String },
    },

    uploadedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      name: {
        type: String,
      },
    },

    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

STSBaseAuditReportSchema.pre("save", async function () {
  try {
    if (this.isNew) {
      if (!this.formCode) {
        this.formCode = getQhseFormCode("STS_BASE_AUDIT") || null;
      }
      if (!this.serialNumber) {
        this.serialNumber = await getNextYearwiseSerial("STS_BASE_AUDIT");
      }
    }
  } catch (error) {
    console.error("STS Base Audit Report Pre-Save Error:", error);
    throw error;
  }
});


STSBaseAuditReportSchema.plugin(qhseArchivePlugin);
STSBaseAuditReportSchema.plugin(qhseRevisionPlugin);

export default mongoose.models.STSBaseAuditReport ||
  mongoose.model("STSBaseAuditReport", STSBaseAuditReportSchema);
