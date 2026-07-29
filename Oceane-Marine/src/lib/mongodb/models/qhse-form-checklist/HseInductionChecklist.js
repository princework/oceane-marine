import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const HSEInductionChecklistSchema = new mongoose.Schema(
  {
    /** Fixed form code (e.g. QAF-OFD-008) */
    formNo: { type: String },

    /** Year-wise document serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },

    revisionNo: {
      type: String,
      default: "1.0",
    },

    revisionDate: {
      type: Date,
    },

    approvedBy: {
      type: String,
    },

    /* =========================
       EMPLOYEE / CONTRACTOR DETAILS
    ========================= */
    employeeOrContractorName: {
      type: String,
      required: true,
    },

    dateOfInduction: {
      type: Date,
      required: true,
    },

    location: {
      type: String,
      required: true,
    },

    /* =========================
       HSE INDUCTION CHECKLIST
    ========================= */
    hseChecklist: {
      hsePolicy: { type: Boolean, default: false },

      facilityTour: { type: Boolean, default: false },

      reportingFire: { type: Boolean, default: false },

      occupationalHazards: { type: Boolean, default: false },

      injuryIllnessNearMissReporting: {
        type: Boolean,
        default: false,
      },

      emergencyActionPlan: {
        type: Boolean,
        default: false,
      },

      wasteManagementProcedures: {
        type: Boolean,
        default: false,
      },

      ppeRequirements: {
        type: Boolean,
        default: false,
      },

      hazcomMsds: {
        type: Boolean,
        default: false,
      },

      spillReportingProcedures: {
        type: Boolean,
        default: false,
      },

      ergonomicsAwareness: {
        type: Boolean,
        default: false,
      },

      housekeepingExpectations: {
        type: Boolean,
        default: false,
      },

      disciplinaryProcedure: {
        type: Boolean,
        default: false,
      },
    },

    /* =========================
       JOB FUNCTION / FACILITY OPERATION
    ========================= */
    jobSpecificChecklist: {
      safeOperationOfToolsMachinery: {
        type: Boolean,
        default: false,
      },

      trainingAndCertificationRequirements: {
        type: Boolean,
        default: false,
      },

      riskAssessmentOverview: {
        type: Boolean,
        default: false,
      },

      safeLiftingAndBackInjuryPrevention: {
        type: Boolean,
        default: false,
      },

      craneOperationAndSlingInspection: {
        type: Boolean,
        default: false,
      },

      loadingUnloadingHandlingProcedures: {
        type: Boolean,
        default: false,
      },
    },

    signatures: {
      employeeSignature: {
        type: String,
      },

      employeeSignatureDate: {
        type: Date,
      },

      inductionGivenBySignature: {
        type: String,
      },
    },

    /* =========================
       SUBMISSION METADATA
    ========================= */
    submittedBy: {
      type: String,
    },

    status: {
      type: String,
      enum: ["Pending", "Rejected", "Approved"],
      default: "Pending",
    },

    rejectionReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

HSEInductionChecklistSchema.pre("save", async function () {
  try {
    if (this.isNew) {
      if (!this.formNo) {
        this.formNo = getQhseFormCode("HSE_INDUCTION_CHECKLIST") || null;
      }
      if (!this.serialNumber) {
        const year = this.dateOfInduction
          ? new Date(this.dateOfInduction).getUTCFullYear()
          : undefined;
        this.serialNumber = await getNextYearwiseSerial("HSE_INDUCTION_CHECKLIST", year);
      }
    }
  } catch (error) {
    console.error("HSE Induction Checklist Pre-Save Error:", error);
    throw error;
  }
});


HSEInductionChecklistSchema.plugin(qhseArchivePlugin);
HSEInductionChecklistSchema.plugin(qhseRevisionPlugin);

export default mongoose.models.HSEInductionChecklist ||
  mongoose.model("HSEInductionChecklist", HSEInductionChecklistSchema);
