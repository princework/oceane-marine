import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const TransferLocationQuestionnaireSchema = new mongoose.Schema(
  {
    /** Fixed form code (QAF-OFD-049) */
    formCode: { type: String },

    /** Year-wise document serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },

    /** Upsert key — matches StsOperation.Operation_Ref_No */
    operationRef: { type: String, required: true, trim: true, index: true },

    /* -------- 1. Location Information -------- */
    location: {
      locationName: { type: String, required: true, trim: true },
      latitude: { type: String, trim: true },
      longitude: { type: String, trim: true },
      country: { type: String, trim: true },
      portOrOffshoreArea: { type: String, trim: true },
      waterDepth: { type: String, trim: true },
    },

    /* -------- 2. Environmental Conditions -------- */
    environmental: {
      weatherConditions: { type: String, trim: true },
      windLimits: { type: String, trim: true },
      waveHeight: { type: String, trim: true },
      currentSpeed: { type: String, trim: true },
      tidalInformation: { type: String, trim: true },
    },

    /* -------- 3. Traffic Information -------- */
    traffic: {
      nearbyShippingLanes: { type: String, trim: true },
      anchorageDetails: { type: String, trim: true },
      trafficDensity: { type: String, trim: true },
    },

    /* -------- 4. Regulatory Information -------- */
    regulatory: {
      localAuthorityApproval: { type: String, trim: true },
      portAuthorityRequirements: { type: String, trim: true },
      environmentalRestrictions: { type: String, trim: true },
    },

    /* -------- 5. Emergency Support -------- */
    emergencySupport: {
      nearestTug: { type: String, trim: true },
      pilotAvailability: { type: String, trim: true },
      medicalAssistance: { type: String, trim: true },
      emergencyContacts: { type: String, trim: true },
    },

    /* -------- 6. Communication -------- */
    communication: {
      vhfChannels: { type: String, trim: true },
      contactPersons: { type: String, trim: true },
      communicationProcedures: { type: String, trim: true },
    },

    /* -------- 7. Operational Restrictions -------- */
    operationalRestrictions: {
      dayNightOperationAllowed: { type: String, trim: true },
      maximumVesselSize: { type: String, trim: true },
      draftLimitations: { type: String, trim: true },
      mooringRestrictions: { type: String, trim: true },
    },

    /* -------- Submitter (external client, no login) -------- */
    submittedByName: { type: String, trim: true },
    submittedByEmail: { type: String, trim: true },

    /* -------- Workflow -------- */
    status: {
      type: String,
      enum: ["Pending Approval", "Approved", "Rejected"],
      default: "Pending Approval",
      index: true,
    },

    rejectionReason: { type: String, trim: true, default: "" },

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },

    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedAt: { type: Date },
  },
  { timestamps: true }
);

TransferLocationQuestionnaireSchema.pre("save", async function () {
  if (this.isNew) {
    if (!this.formCode) {
      this.formCode = getQhseFormCode("STS_TRANSFER_LOCATION_QUEST") || null;
    }
    if (!this.serialNumber) {
      this.serialNumber = await getNextYearwiseSerial("STS_TRANSFER_LOCATION_QUEST");
    }
  }
});

TransferLocationQuestionnaireSchema.plugin(qhseArchivePlugin);
TransferLocationQuestionnaireSchema.plugin(qhseRevisionPlugin);

if (process.env.NODE_ENV !== "production" && mongoose.models.TransferLocationQuestionnaire) {
  delete mongoose.models.TransferLocationQuestionnaire;
}

export default mongoose.models.TransferLocationQuestionnaire ||
  mongoose.model("TransferLocationQuestionnaire", TransferLocationQuestionnaireSchema);
