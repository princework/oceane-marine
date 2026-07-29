import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

/* ----------------------------------------
   SUB-CONTRACTOR AUDIT SCHEMA
   Form code = fixed per form type (e.g. OPS-OFD-212).
   Instance = serialNumber (YYYY-NNN) + revisionNo (1.0, 1.1, ...).
----------------------------------------- */
const SubContractorAuditSchema = new mongoose.Schema(
  {
    /** Fixed form code for this form type (e.g. OPS-OFD-212) */
    formCode: {
      type: String,
      index: true,
    },

    /** Year-wise document serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },

    /** Revision: 1.0 for new, then 1.1, 1.2, ... */
    revisionNo: { type: String, default: "1.0" },
    revisionDate: { type: Date },

    /* -------- SUB-CONTRACTOR DETAILS -------- */
    subcontractorName: {
      type: String,
      required: true,
      trim: true,
    },

    subcontractorAddress: {
      type: String,
      required: true,
      trim: true,
    },

    serviceType: {
      type: String,
      required: true,
      trim: true,
    },

    contactPerson: {
      type: String,
      required: true,
      trim: true,
    },
    emailOfContactPerson: {
      type: String,
      required: true,
      trim: true,
    },

    phoneOfContactPerson: {
      type: String,
      required: true,
      trim: true,
    },
    operatingAreas: {
      type: String,
      trim: true,
    },

    /* -------- COMPLIANCE QUESTIONS -------- */
    tradeLicenseCopyAvailable: {
      type: Boolean,
      default: false,
    },

    hasHSEPolicy: {
      type: Boolean,
      default: false,
    },

    auditsSubcontractors: {
      type: Boolean,
      default: false,
    },

    hasInsurance: {
      type: Boolean,
      default: false,
    },

    insuranceDetails: {
      type: String,
      trim: true,
    },

    isoCertifications: {
      type: [String], // ISO 9001, ISO 14001, ISO 45001
      default: [],
    },

    /* -------- OFFICE USE -------- */
    auditCompletedBy: {
      name: { type: String, trim: true },
      designation: { type: String, trim: true },
      signedAt: { type: Date },
      /** Typed signature (e.g. full name as signature) */
      signatureText: { type: String, trim: true },
      /** Signature image (base64 data URL or URL string) */
      signaturePhoto: { type: String },
    },

    contractorApprovedBy: {
      name: { type: String, trim: true },
      designation: { type: String, trim: true },
      signedAt: { type: Date },
      /** Typed signature (e.g. full name as signature) */
      signatureText: { type: String, trim: true },
      /** Signature image (base64 data URL or URL string) */
      signaturePhoto: { type: String },
    },

    /* -------- STATUS -------- */
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
  },
  { timestamps: true }
);

/* ----------------------------------------
   PRE-SAVE: fixed form code + yearwise serial + revision
----------------------------------------- */
SubContractorAuditSchema.pre("save", async function () {
  try {
    if (this.isNew) {
      if (!this.formCode) {
        this.formCode = getQhseFormCode("SUB_CONTRACTOR_AUDIT") || null;
      }
      if (!this.serialNumber) {
        const dateForYear =
          this.auditCompletedBy?.signedAt ||
          this.contractorApprovedBy?.signedAt ||
          this.createdAt ||
          new Date();
        const year = new Date(dateForYear).getUTCFullYear();
        this.serialNumber = await getNextYearwiseSerial("SUB_CONTRACTOR_AUDIT", year);
      }
      if (!this.revisionNo) {
        this.revisionNo = "1.0";
      }
    }
  } catch (error) {
    console.error("Sub Contractor Audit Pre-Save Error:", error);
    throw error;
  }
});


SubContractorAuditSchema.plugin(qhseArchivePlugin);
SubContractorAuditSchema.plugin(qhseRevisionPlugin);

export default mongoose.models.SubContractorAudit ||
  mongoose.model("SubContractorAudit", SubContractorAuditSchema);
