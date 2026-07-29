import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const NearMissSchemaForms = new mongoose.Schema(
  {
    /** Fixed form code (e.g. QAF-OFD-015) */
    formCode: { type: String, index: true },

    /** Year-wise serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },
    JobRefNo: {
      type: String,
      required: true,
      trim: true,
    },
    VesselName: {
      type: String,
      required: true,
      trim: true,
    },
    timeOfIncident: {
      type: Date,
      required: true,
    },
    NameOfObserver: {
      type: String,
      required: true,
      trim: true,
    },
    PositionOfObserver: {
      type: String,
      enum: ["Mooring Master - POAC", "Management", "Third Party", "Other"],
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    TypeOfReporting: {
      type: String,
      enum: [
        "Near Miss",
        "Collision",
        "Fatality",
        "Injury",
        "Pollution",
        "Contact Damage",
        "Best Practice",
      ],
      required: true,
    },
    AreaOfNearMiss: {
      type: String,
      enum: [
        "Main Deck",
        "Bridge",
        "Offshore",
        "Support Craft",
        "Manifold Area",
        "Mobilization & Demobilization",
        "Transportation",
        "Cargo Control Room",
        "Underway / Anchoring",
        "Other",
      ],
      required: true,
    },
    Description: {
      type: String,
      required: true,
      trim: true,
    },
    ImmediateCause: {
      type: String,
      required: true,
      trim: true,
    },
    RootCause: {
      type: String,
      required: true,
      trim: true,
    },
    CorrectiveAction: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Under Review", "Reviewed"],
      default: "Under Review",
    },
    remarksByReviewer: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

NearMissSchemaForms.pre("save", async function () {
  if (this.isNew) {
    if (!this.formCode) {
      this.formCode = getQhseFormCode("NEAR_MISS") || null;
    }
    if (!this.serialNumber) {
      this.serialNumber = await getNextYearwiseSerial("NEAR_MISS");
    }
  }
});

NearMissSchemaForms.plugin(qhseArchivePlugin);
NearMissSchemaForms.plugin(qhseRevisionPlugin);

export default mongoose.models.NearMissForms ||
  mongoose.model("NearMissForms", NearMissSchemaForms);
