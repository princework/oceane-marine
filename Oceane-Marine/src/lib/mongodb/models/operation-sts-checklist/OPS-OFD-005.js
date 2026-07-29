import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";

// ================= DOCUMENT INFO =================
const DocumentInfoSchema = new mongoose.Schema({
    formNo: String,
    revisionNo: String,
    issueDate: Date,
    approvedBy: String,
}, { _id: false });


// ================= TRANSFER INFO =================
const TransferInfoSchema = new mongoose.Schema({
    constantHeadingShip: String,
    manoeuvringShip: String,
    designatedPOACName: String,
    stsSuperintendentName: String,
    transferDate: Date,
    transferLocation: String
}, { _id: false });


// ================= STATUS =================
const StatusSchema = new mongoose.Schema({
    yes: Boolean,
    notApplicable: Boolean
}, { _id: false });


// ================= CHECKLIST 5A ITEM =================
const Checklist5AItemSchema = new mongoose.Schema({
    clNumber: Number,
    description: String,
    status: StatusSchema,
    remarks: String
}, { _id: false });


// ================= TIME CHECK CELL =================
const TimeCheckCellSchema = new mongoose.Schema({
    timeLabel: String,     // Time1, Time2, Time3 etc
    yes: Boolean
}, { _id: false });


// ================= REPETITIVE CHECK ROW =================
const RepetitiveCheckRowSchema = new mongoose.Schema({
    checkName: String,

    ref: String, // optional (present in some rows)

    timeChecks: [TimeCheckCellSchema],

    notApplicable: Boolean,

    remarks: String
}, { _id: false });


// ================= REPETITIVE CHECK SECTION =================
const RepetitiveSectionSchema = new mongoose.Schema({

    noteIntervalHours: Number,

    entityName: String,
    // Ship Name OR Terminal Name depending section

    rows: [RepetitiveCheckRowSchema],

    initials: [String]  // Array of strings - one for each time column (6 columns)

}, { _id: false });


// ================= SIGNATURE =================
const SignatureSchema = new mongoose.Schema({
    name: String,
    rank: String,
    signature: String,
    date: Date
}, { _id: false });


// ======================================================
// ================= MAIN SCHEMA =========================
// ======================================================

const STSChecklist5ACSchema = new mongoose.Schema({

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

    // ===== TRANSFER INFO =====
    transferInfo: TransferInfoSchema,


    // =================================================
    // ===== CHECKLIST 5A =====
    // =================================================
    checklist5A: [Checklist5AItemSchema],


    // =================================================
    // ===== CHECKLIST 5B — SHIP REPETITIVE =====
    // =================================================
    checklist5BShip: RepetitiveSectionSchema,


    // =================================================
    // ===== CHECKLIST 5C — TERMINAL REPETITIVE =====
    // =================================================
    checklist5CTerminal: RepetitiveSectionSchema,


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

STSChecklist5ACSchema.pre("save", async function () {

    // Only generate for new document
    if (!this.isNew || this.sequenceNumber) return;

    const year = new Date().getFullYear();

    const counter = await FormCounterStsCheckList.findOneAndUpdate(
        {
            key: "STS_CHECKLIST_OPS-OFD-005",
            year
        },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    const padded = String(counter.seq).padStart(3, "0");

    this.sequenceNumber = `${year}-${padded}`;
});

export default mongoose.models.STSChecklist5 ||
    mongoose.model("STSChecklist5", STSChecklist5ACSchema);
