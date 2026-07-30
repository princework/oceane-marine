import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const EquipmentDefectSchema = new mongoose.Schema(
  {
    /** Fixed form code (e.g. QAF-OFD-025) */
    formCode: { type: String, index: true },

    /** Year-wise serial: YYYY-NNN (e.g. 2026-001); independent from formCode */
    serialNumber: { type: String },

    /** Free-text description of the fault */
    equipmentDefect: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * PMS equipment this defect is raised against.
     *
     * `equipmentSource` names the collection `equipmentId` points at — primary
     * equipment and accessories live in separate collections, so a single
     * Mongoose `ref` can't resolve both.
     *
     * The code/serial/name fields are a snapshot taken when the defect was
     * logged. They're denormalised on purpose: the list search, PDF, DOCX and
     * archive payload all read plain strings, and a closed defect should keep
     * the label it was raised against even if the PMS record is later renamed
     * or deleted. Optional so pre-existing defects stay valid.
     */
    equipmentId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    equipmentSource: {
      type: String,
      enum: ["Equipment", "Accessories"],
    },

    equipmentCode: { type: String, trim: true, default: "" },

    equipmentSerialCode: { type: String, trim: true, default: "" },

    equipmentName: { type: String, trim: true, default: "" },

    /** Location label — sourced from the PMS Location master */
    base: {
      type: String,
      required: true,
      trim: true,
    },

    actionRequired: {
      type: String,
      required: true,
      trim: true,
    },

    targetDate: {
      type: Date,
      required: true,
    },

    completionDate: {
      type: Date,
    },

    status: {
      type: String,
      enum: ["Open", "In Progress", "Closed"],
      default: "Open",
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    /** Photos/files attached to this defect */
    attachments: [
      {
        path: { type: String, required: true },
        originalName: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

EquipmentDefectSchema.pre("save", async function () {
  try {
    if (this.isNew) {
      // Serial year from target date (form field), not creation date
      let year = new Date().getFullYear();
      if (this.targetDate) {
        const targetYear = new Date(this.targetDate).getFullYear();
        if (!Number.isNaN(targetYear)) year = targetYear;
      }
      if (!this.formCode) {
        this.formCode = getQhseFormCode("EQUIPMENT_DEFECT") || null;
      }
      if (!this.serialNumber) {
        this.serialNumber = await getNextYearwiseSerial("EQUIPMENT_DEFECT", year);
      }
    }
  } catch (error) {
    console.error("Equipment Defect Pre-Save Error:", error);
    throw error;
  }
});

// Recompile so enum changes (e.g. "In Progress") are picked up after code updates
if (mongoose.models.EquipmentDefect) {
  delete mongoose.models.EquipmentDefect;
}

EquipmentDefectSchema.plugin(qhseArchivePlugin);
EquipmentDefectSchema.plugin(qhseRevisionPlugin);

export default mongoose.model("EquipmentDefect", EquipmentDefectSchema);
