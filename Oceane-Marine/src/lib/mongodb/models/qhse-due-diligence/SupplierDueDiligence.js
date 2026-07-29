import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const SupplierDueDiligenceSchema = new mongoose.Schema(
  {
    /** Fixed form code (e.g. QAF-OFD-043) */
    formCode: { type: String, index: true },

    /** Year-wise serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },

    version: {
      type: String,
      default: "1.0",
    },

    revisionDate: {
      type: Date,
    },

    /* ---------- BASIC DETAILS (Q1–Q9) ---------- */
    supplierDetails: {
      inchargeNameAndCompany: { type: String, required: true },
      contactDetails: { type: String, required: true },
      companyRegistrationDetails: { type: String },
      parentCompanyDetails: { type: String },
      hasSubsidiaries: { type: Boolean },
      subsidiariesDetails: { type: String },
      employeeCount: { type: Number },
      businessActivities: { type: String },
      operatingLocations: { type: String },
      paymentTerms: { type: String },
    },

    /* ---------- LEGAL & FINANCIAL DECLARATIONS (Q10–Q15) ---------- */
    legalDeclarations: {
      missingLicenses: { type: Boolean },
      criminalOffenceHistory: { type: Boolean },
      insolvencyStatus: { type: Boolean },
      businessMisconduct: { type: Boolean },
      unpaidStatutoryPayments: { type: Boolean },
      declarationDetails: { type: String },
    },

    /* ---------- INSURANCE DETAILS (Q16–Q19) ---------- */
    insuranceDetails: {
      pAndI: { type: String },
      workersCompensation: { type: String },
      publicLiability: { type: String },
      otherInsurance: { type: String },
    },

    /* ---------- QUALITY & COMPLIANCE (Q20–Q28) ---------- */
    complianceDetails: {
      qualityManagementSystem: {
        registered: { type: Boolean },
        dateAccredited: { type: Date },
        accreditedBy: { type: String },
      },
      environmentalPolicy: { type: Boolean },
      esgProgramme: { type: Boolean },
      otherCertifications: { type: String },
      isoCertification: { type: String }, // ISO 9001/14001/45001
      drugAlcoholPolicy: { type: Boolean },
      drugAlcoholProcedure: { type: String },
      healthSafetyPolicy: { type: Boolean },
      incidentsLastTwoYears: { type: Boolean },
      incidentDetails: { type: String },
    },

    /* ---------- ETHICS & GOVERNANCE (Q29–Q37) ---------- */
    ethicsAndGovernance: {
      ethicalConductPolicy: { type: Boolean },
      equalityDiversityPolicy: { type: Boolean },
      subcontracting: { type: Boolean },
      subcontractingDetails: { type: String },
      dueDiligenceForSubcontractors: { type: Boolean },
      antiCorruptionAcknowledged: { type: Boolean },
      modernSlaveryAcknowledged: { type: Boolean },
      sanctionsExposure: { type: Boolean },
    },

    /* ---------- FINANCIAL & DATA PROTECTION (Q38–Q41) ---------- */
    financialAndData: {
      creditRatingDetails: { type: String },
      turnoverLastTwoYears: { type: String },
      dataProtectionPolicy: { type: Boolean },
      bankerDetails: {
        name: { type: String },
        branch: { type: String },
        contactDetails: { type: String },
        ibanOrAccountNumber: { type: String },
      },
    },

    /* ---------- DECLARATIONS ---------- */
    generalDeclaration: {
      name: { type: String },
      positionHeld: { type: String },
      signedAt: { type: Date },
      signature: { type: String }, // base64 or file ref
    },

    purchasingDeclaration: {
      name: { type: String },
      positionHeld: { type: String },
      signedAt: { type: Date },
      signature: { type: String },
    },

    /** Optional uploaded documents (e.g. supporting files). */
    additionalDocuments: [
      {
        name: { type: String },
        fileName: { type: String },
        url: { type: String },
        filePath: { type: String },
      },
    ],

    /* ---------- STATUS & APPROVAL ---------- */
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

SupplierDueDiligenceSchema.pre("save", async function () {
  try {
    if (this.isNew) {
      if (!this.formCode) {
        this.formCode = getQhseFormCode("SUPPLIER_DUE_DILIGENCE") || null;
      }
      if (!this.serialNumber) {
        this.serialNumber = await getNextYearwiseSerial("SUPPLIER_DUE_DILIGENCE");
      }
    }
  } catch (error) {
    console.error("Supplier Due Diligence Pre-Save Error:", error);
    throw error;
  }
});


SupplierDueDiligenceSchema.plugin(qhseArchivePlugin);
SupplierDueDiligenceSchema.plugin(qhseRevisionPlugin);

export default mongoose.models.SupplierDueDiligence ||
  mongoose.model("SupplierDueDiligence", SupplierDueDiligenceSchema);
