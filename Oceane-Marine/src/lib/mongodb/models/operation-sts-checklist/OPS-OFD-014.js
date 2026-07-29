import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";


// ================= DOCUMENT INFO =================
const DocumentInfoSchema = new mongoose.Schema({
    formNo: String,
    revisionNo: String,
    issueDate: Date,
    approvedBy: String,
    page: String
}, { _id: false });


// ================= JOB INFO =================
const JobInfoSchema = new mongoose.Schema({
    date: Date,
    time: String,
    mooringMasterName: String,
    location: String,

    operationPhase: {
        type: String,
        enum: ["BEFORE_OPERATION", "AFTER_OPERATION"]
    }
}, { _id: false });


// =================================================
// ================= TABLE 1 — FENDER EQUIPMENT =====
// =================================================
const FenderEquipmentRowSchema = new mongoose.Schema({
    fenderId: String,
    endPlates: String,
    bShackle: String,
    swivel: String,
    secondShackle: String,
    mooringShackle: String,
    fenderBody: String,
    tires: String,
    pressure: String
}, { _id: false });


// =================================================
// ================= TABLE 2 — HOSE EQUIPMENT =======
// =================================================
const HoseEquipmentRowSchema = new mongoose.Schema({
    hoseId: String,
    endFlanges: String,
    bodyCondition: String,
    nutsBolts: String,
    markings: String
}, { _id: false });


// =================================================
// ================= TABLE 3 — OTHER EQUIPMENT ======
// =================================================
const OtherEquipmentRowSchema = new mongoose.Schema({
    equipmentId: String,
    gaskets: String,
    ropes: String,
    wires: String,
    billyPugh: String,
    liftingStrops: String
}, { _id: false });


// ================= SIGNATURE =================
const SignatureSchema = new mongoose.Schema({
    mooringMasterSignature: String
}, { _id: false });


// ======================================================
// ================= MAIN SCHEMA =========================
// ======================================================

const STSEquipmentChecklistSchema = new mongoose.Schema({
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

    jobInfo: JobInfoSchema,


    // TABLE ARRAYS (IMPORTANT)
    fenderEquipment: [FenderEquipmentRowSchema],

    hoseEquipment: [HoseEquipmentRowSchema],

    otherEquipment: [OtherEquipmentRowSchema],


    remarks: String,

    signatureBlock: SignatureSchema,


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

STSEquipmentChecklistSchema.pre("save", async function () {
  // Only generate for new document
  if (!this.isNew || this.sequenceNumber) return;

  const year = new Date(
    this.documentInfo?.issueDate || 
    this.jobInfo?.date || 
    Date.now()
  ).getFullYear();

  const counter = await FormCounterStsCheckList.findOneAndUpdate(
    {
      key: "STS_CHECKLIST_OPS-OFD-014",
      year
    },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const padded = String(counter.seq).padStart(3, "0");

  this.sequenceNumber = `${year}-${padded}`;
});

export default mongoose.models.STSEquipmentChecklist ||
    mongoose.model("STSEquipmentChecklist", STSEquipmentChecklistSchema);
