import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";


// ================= DOCUMENT INFO =================
const DocumentInfoSchema = new mongoose.Schema({
    formNo: String,
    revisionNo: String,
    issueDate: Date,
    approvedBy: String,
}, { _id: false });


// ================= SIGNATURE BLOCK =================
const SignatureBlockSchema = new mongoose.Schema({
    masterName: String,

    vesselName: String, // SS / MV

    signedDate: Date,

    signedTime: String, // HH:MM

    shipStampImage: String // base64 or cloud url
}, { _id: false });


// ======================================================
// ================= MAIN SCHEMA =========================
// ======================================================

const STSStandingOrderSchema = new mongoose.Schema({

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


    // ===== EDITABLE CONTENT =====
    superintendentSpecificInstructions: String,


    // ===== SIGNING =====
    signatureBlock: SignatureBlockSchema,


    // ===== WORKFLOW =====
    status: {
        type: String,
        enum: ["DRAFT", "SUBMITTED", "SIGNED", "ARCHIVED"],
        default: "DRAFT"
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }

}, { timestamps: true });

STSStandingOrderSchema.pre("save", async function () {
  // Only generate for new document
  if (!this.isNew || this.sequenceNumber) return;

  const year = new Date(
    this.documentInfo?.issueDate || Date.now()
  ).getFullYear();

  const counter = await FormCounterStsCheckList.findOneAndUpdate(
    {
      key: "STS_CHECKLIST_OPS-OFD-011",
      year
    },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const padded = String(counter.seq).padStart(3, "0");

  this.sequenceNumber = `${year}-${padded}`;
});

export default mongoose.models.STSStandingOrder ||
    mongoose.model("STSStandingOrder", STSStandingOrderSchema);
