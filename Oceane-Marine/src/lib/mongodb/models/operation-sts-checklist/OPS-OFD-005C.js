import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";

// ================= DOCUMENT INFO =================
const DocumentInfoSchema = new mongoose.Schema({
    formNo: String,
    revisionNo: String,
    issueDate: Date,
    approvedBy: String,
}, { _id: false });


// ================= TERMINAL TRANSFER INFO =================
const TerminalTransferInfoSchema = new mongoose.Schema({
    terminalBerthedShip: String,
    outerShip: String,
    terminal: String
}, { _id: false });


// ================= TRIPLE STATUS =================
const TripleStatusSchema = new mongoose.Schema({
    terminalBerthedShip: Boolean,
    outerShip: Boolean,
    terminal: Boolean
}, { _id: false });


// ================= CHECKLIST ITEM =================
const Checklist5CItemSchema = new mongoose.Schema({
    clNumber: Number,
    description: String,
    status: TripleStatusSchema,
    remarks: String
}, { _id: false });


// ================= RESPONSIBLE PERSONS =================
const ResponsiblePersonsSchema = new mongoose.Schema({
    chsOfficerName: String,
    msOfficerName: String,
    terminalRepresentativeName: String,
    stsSuperintendentName: String
}, { _id: false });


// ======================================================
// ================= MAIN SCHEMA =========================
// ======================================================

const STSChecklist5CSchema = new mongoose.Schema({

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

    // ===== TERMINAL / SHIP INFO =====
    terminalTransferInfo: TerminalTransferInfoSchema,


    // ===== CHECKLIST ITEMS (1 → 10) =====
    checklistItems: [Checklist5CItemSchema],


    // ===== RESPONSIBLE SIGN OFF =====
    responsiblePersons: ResponsiblePersonsSchema,


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

STSChecklist5CSchema.pre("save", async function () {

    // Only generate for new document
    if (!this.isNew || this.sequenceNumber) return;

    const year = new Date(
        this.documentInfo?.issueDate || Date.now()
    ).getFullYear();

    const counter = await FormCounterStsCheckList.findOneAndUpdate(
        {
            key: "STS_CHECKLIST_OPS-OFD-005C",
            year
        },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    const padded = String(counter.seq).padStart(3, "0");

    this.sequenceNumber = `${year}-${padded}`;
});

export default mongoose.models.STSChecklist5C ||
    mongoose.model("STSChecklist5C", STSChecklist5CSchema);
