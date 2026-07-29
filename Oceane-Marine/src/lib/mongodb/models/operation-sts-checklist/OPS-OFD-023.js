import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";

// ================= DOCUMENT INFO =================
const DocumentInfoSchema = new mongoose.Schema({
    formNo: String,
    revisionNo: String,
    issueDate: Date,
    approvedBy: String,
}, { _id: false });

// ================= HEADER DETAILS =================
const HeaderDetailsSchema = new mongoose.Schema({
    stsOperation: String,
    date: Date,
    mooringMaster: String,
    remark: String,
}, { _id: false });

// ================= DAILY WORK ENTRY =================
const DailyWorkEntrySchema = new mongoose.Schema({
    day: { type: Number, min: 1, max: 31 },
    // 24 hour slots (index 0 = 01:00, index 23 = 23:59)
    // true = work period, false = rest period
    hourSlots: {
        type: [Boolean],
        default: () => Array(24).fill(false),
    },
    hoursOfRest: { type: Number, default: 0 },
    comments: { type: String, default: "" },
}, { _id: false });

// ======================================================
// ================= MAIN SCHEMA =========================
// ======================================================

const RecordOfWorkHoursSchema = new mongoose.Schema({

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

    // ===== HEADER DETAILS =====
    headerDetails: HeaderDetailsSchema,

    // ===== WORK ENTRIES (31 days) =====
    workEntries: [DailyWorkEntrySchema],

    // ===== NOTES (dynamic array) =====
    notes: {
        type: [String],
        default: [],
    },

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

RecordOfWorkHoursSchema.pre("save", async function () {
    if (!this.isNew || this.sequenceNumber) return;

    const year = new Date().getFullYear();

    const counter = await FormCounterStsCheckList.findOneAndUpdate(
        {
            key: "STS_CHECKLIST_OPS-OFD-023",
            year
        },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    const padded = String(counter.seq).padStart(3, "0");
    this.sequenceNumber = `${year}-${padded}`;
});

export default mongoose.models.RecordOfWorkHours ||
    mongoose.model("RecordOfWorkHours", RecordOfWorkHoursSchema);
