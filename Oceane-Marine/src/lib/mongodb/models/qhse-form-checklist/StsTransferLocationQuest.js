import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const STSTransferLocationQuestSchema = new mongoose.Schema(
  {
    /** Fixed form code (e.g. QAF-OFD-049) */
    formCode: { type: String },

    /** Year-wise document serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },

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

    locationName: {
      type: String,
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
  {
    timestamps: true,
  }
);

STSTransferLocationQuestSchema.pre("save", async function () {
  try {
    if (this.isNew) {
      if (!this.formCode) {
        this.formCode = getQhseFormCode("STS_TRANSFER_LOCATION_QUEST") || null;
      }
      if (!this.serialNumber && this.date) {
        const year = new Date(this.date).getUTCFullYear();
        this.serialNumber = await getNextYearwiseSerial("STS_TRANSFER_LOCATION_QUEST", year);
      }
    }
  } catch (error) {
    console.error("STS Transfer Location Questionnaire Pre-Save Error:", error);
    throw error;
  }
});


STSTransferLocationQuestSchema.plugin(qhseArchivePlugin);
STSTransferLocationQuestSchema.plugin(qhseRevisionPlugin);

export default mongoose.models.STSTransferLocationQuest ||
  mongoose.model("STSTransferLocationQuest", STSTransferLocationQuestSchema);
