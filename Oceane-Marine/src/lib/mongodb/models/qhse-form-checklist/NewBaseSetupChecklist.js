import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const NewBaseSetupChecklistSchema = new mongoose.Schema(
  {
    /** Fixed form code (e.g. QAF-OFD-051) */
    formCode: { type: String },

    /** Year-wise document serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },

    baseName: {
      type: String,
      required: true,
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
  { timestamps: true }
);

NewBaseSetupChecklistSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      if (!this.formCode) {
        this.formCode = getQhseFormCode("NEW_BASE_SETUP") || null;
      }
      if (!this.serialNumber && this.date) {
        const year = new Date(this.date).getUTCFullYear();
        this.serialNumber = await getNextYearwiseSerial("NEW_BASE_SETUP", year);
      }
    }
  } catch (error) {
    console.error("New Base Setup Checklist Pre-Save Error:", error);
    throw error;
  }
});


NewBaseSetupChecklistSchema.plugin(qhseArchivePlugin);
NewBaseSetupChecklistSchema.plugin(qhseRevisionPlugin);

export default mongoose.models.NewBaseSetupChecklist ||
  mongoose.model("NewBaseSetupChecklist", NewBaseSetupChecklistSchema);
