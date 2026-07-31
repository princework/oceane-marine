import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const VendorApprovalSchema = new mongoose.Schema(
  {
    /** Fixed form code (e.g. QAF-OFD-037) */
    formNo: { type: String },
    /** Same as formNo for display consistency with other QHSE forms */
    formCode: { type: String },

    /** Vendor this rating is for — only creatable once Stage 2 (audit) is Approved. */
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MasterVendor",
      index: true,
    },

    /** Year-wise document serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },

    revisionNo: {
      type: String,
      default: "1.0",
    },

    revisionDate: {
      type: Date,
    },

    vendorName: {
      type: String,
      required: true,
    },
    
    vendorAddress: {
      type: String,
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    year: {
      type: Number,
      // Optional for backward compatibility, but required in form validation
    },

    /* =========================
       RATING SCALE
       1 = Not Satisfied
       2 = Need Improvement
       3 = Acceptable
       4 = Satisfied
    ========================= */

    /* ---------- FOR SUPPLY OF PARTS ---------- */
    supplyOfParts: {
      technicalComparison: {
        type: Number,
        min: 1,
        max: 4,
      },

      commercialComparison: {
        type: Number,
        min: 1,
        max: 4,
      },

      legalEntityForServiceOrSupply: {
        type: Number,
        min: 1,
        max: 4,
      },

      agreesToOceaneTerms: {
        type: Number,
        min: 1,
        max: 4,
      },

      infrastructureAndFacilities: {
        type: Number,
        min: 1,
        max: 4,
      },

      previousExperienceExpertise: {
        type: Number,
        min: 1,
        max: 4,
      },

      percentageScore: {
        type: Number, // stored value (calculated in backend)
        default: 0,
      },
    },

    /* ---------- FOR SUPPLY OF SERVICES ---------- */
    supplyOfServices: {
      skilledManpowerAvailability: {
        type: Number,
        min: 1,
        max: 4,
      },

      contractorCertifications: {
        type: Number,
        min: 1,
        max: 4,
      },

      hseSystemDueDiligence: {
        type: Number,
        min: 1,
        max: 4,
      },

      insuranceAndWorkPermit: {
        type: Number,
        min: 1,
        max: 4,
      },

      previousExperienceYears: {
        type: Number,
        min: 1,
        max: 4,
      },

      percentageScore: {
        type: Number,
        default: 0,
      },
    },

    /* =========================
       OVERALL RESULT
    ========================= */
    overallPercentageScore: {
      type: Number,
      default: 0,
    },

    approvedVendorEligible: {
      type: Boolean,
      default: false, // true if >= 80%
    },

    /* =========================
       SIGNATURES
    ========================= */

    requestedBy: {
      type: String,
      required: true,
    },

    forAccountsSign: {
      type: String,
      required: true,
    },

    /** Optional signature image URLs (uploaded file paths) */
    requestedBySignatureImage: { type: String },
    forAccountsSignSignatureImage: { type: String },

    status: {
      type: String,
      enum: ["DRAFT", "UNDER_REVIEW", "APPROVED", "REJECTED"],
      default: "DRAFT",
    },

    approvedBy: {
      // Store name / identifier of approver as a simple string for now
      type: String,
    },

    approvedAt: {
      type: Date,
    },

    rejectionReason: {
      type: String,
    },

    instructionsToAccountsDepartment: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

VendorApprovalSchema.pre("save", async function () {
  try {
    if (this.isNew) {
      const code = getQhseFormCode("VENDOR_SUPPLIER_APPROVAL") || null;
      if (!this.formNo) this.formNo = code;
      if (!this.formCode) this.formCode = code;
      if (!this.serialNumber) {
        this.serialNumber = await getNextYearwiseSerial(
          "VENDOR_SUPPLIER_APPROVAL",
          this.year
        );
      }
    }
  } catch (error) {
    console.error("Vendor Supplier Approval Pre-Save Error:", error);
    throw error;
  }
});


VendorApprovalSchema.plugin(qhseArchivePlugin);
VendorApprovalSchema.plugin(qhseRevisionPlugin);

/**
 * Next.js dev hot-reload keeps the first-compiled model in memory; schema
 * field additions (e.g. vendorId) are ignored until the process restarts
 * unless we drop the cached model before re-registering.
 */
if (process.env.NODE_ENV !== "production" && mongoose.models.VendorApproval) {
  delete mongoose.models.VendorApproval;
}

export default mongoose.models.VendorApproval ||
  mongoose.model("VendorApproval", VendorApprovalSchema);
