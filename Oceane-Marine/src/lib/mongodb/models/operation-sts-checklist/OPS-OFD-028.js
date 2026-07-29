import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";


// ================= DOCUMENT INFO =================
const DocumentInfoSchema = new mongoose.Schema({
    formNo: String,
    revisionNo: String,
    revisionDate: Date,
    approvedBy: String,
}, { _id: false });


// ================= SIGNATURE =================
const SignatureSchema = new mongoose.Schema({
    signatureImage: String, // base64 or cloud URL
    stampImage: String
}, { _id: false });


// ======================================================
// ================= MAIN SCHEMA =========================
// ======================================================

const STSChecklist8Schema = new mongoose.Schema({

    // ===== HEADER =====
    operationRef: {
        type: String,
        required: true,
        index: true
    },

    sequenceNumber: {
        type: String,
        unique: true,
        index: true
    },

    documentInfo: DocumentInfoSchema,


    // ===== FORM DATA =====
    jobReference: String,

    masterName: String,

    vesselName: String, // SS/MV

    signedDate: Date,

    signedTime: String, // HH:MM format

    timeZoneLabel: String, // LT or others if future needed


    // ===== SIGNATURE =====
    signatureBlock: SignatureSchema,


    // ===== WORKFLOW =====
    status: {
        type: String,
        enum: ["DRAFT", "SUBMITTED", "APPROVED"],
        default: "DRAFT"
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }

}, { timestamps: true });

STSChecklist8Schema.pre("save", async function () {
  // Only generate for new document
  if (!this.isNew || this.sequenceNumber) return;

  const year = new Date(
    this.documentInfo?.revisionDate || Date.now()
  ).getFullYear();

  const counter = await FormCounterStsCheckList.findOneAndUpdate(
    {
      key: "STS_CHECKLIST_OPS-OFD-028",
      year
    },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const padded = String(counter.seq).padStart(3, "0");

  this.sequenceNumber = `${year}-${padded}`;
});

export default mongoose.models.STSChecklist8 ||
    mongoose.model("STSChecklist8", STSChecklist8Schema);
