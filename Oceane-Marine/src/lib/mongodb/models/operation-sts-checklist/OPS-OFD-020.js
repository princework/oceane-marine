import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";

// ================= DOCUMENT INFO =================
const DocumentInfoSchema = new mongoose.Schema({
    formNo: String,
    revisionNo: String,
    issueDate: Date,
    approvedBy: String,
}, { _id: false });

// ================= JOB DETAILS =================
const JobDetailsSchema = new mongoose.Schema({
    vesselName: String,
    dateOfOperation: Date,
    location: String,
    nameOfPOAC: String,
}, { _id: false });

// ================= PERFORMANCE ITEM =================
const PerformanceItemSchema = new mongoose.Schema({
    srNo: Number,
    criteria: String,
    score: {
        type: String,
        enum: ["1", "2", "3", "4", "5", ""],
        default: ""
    },
    comments: String,
}, { _id: false });

// ================= SIGNATURE =================
const SignatureSchema = new mongoose.Schema({
    masterName: String,
    stampSignature: String,   // file path or base64
    date: Date,
}, { _id: false });

// ======================================================
// ================= MAIN SCHEMA =========================
// ======================================================

const MasterFeedbackFormSchema = new mongoose.Schema({

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

    // ===== JOB DETAILS =====
    jobDetails: JobDetailsSchema,

    // ===== PERFORMANCE CRITERIA =====
    performanceItems: [PerformanceItemSchema],

    // ===== OVERALL FEEDBACK =====
    overallFeedback: {
        type: String,
        default: ""
    },

    // ===== SIGNATURE =====
    signature: SignatureSchema,

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

MasterFeedbackFormSchema.pre("save", async function () {
    if (!this.isNew || this.sequenceNumber) return;

    const year = new Date().getFullYear();

    const counter = await FormCounterStsCheckList.findOneAndUpdate(
        {
            key: "STS_CHECKLIST_OPS-OFD-020",
            year
        },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    const padded = String(counter.seq).padStart(3, "0");
    this.sequenceNumber = `${year}-${padded}`;
});

export default mongoose.models.MasterFeedbackForm ||
    mongoose.model("MasterFeedbackForm", MasterFeedbackFormSchema);
