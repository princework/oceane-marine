import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";

// ================= DOCUMENT INFO =================
const DocumentInfoSchema = new mongoose.Schema({
    formNo: String,
    revisionNo: String,
    issueDate: Date,
    approvedBy: String,
}, { _id: false });


// ================= TRANSFER BASIC INFO =================
const TransferInfoSchema = new mongoose.Schema({
    constantHeadingShip: String,
    manoeuvringShip: String,
    designatedPOACName: String,
    stsSuperintendentName: String,
    transferDate: Date,
    transferLocation: String
}, { _id: false });


// ================= CHECK ITEM =================
const CheckItemSchema = new mongoose.Schema({
    clNumber: Number,
    description: String,

    status: {
        type: String,
        enum: ["YES", "NO"],  // Frontend sends "YES" or empty string
        default: "NO"
    },

    remarks: String  // Can be "NOT_APPLICABLE" or any text string

}, { _id: false });


// ================= SIGNATURE =================
const SignatureSchema = new mongoose.Schema({
    rank: String,
    signature: String, // base64 or url
    date: Date
}, { _id: false });


// ================= MAIN SCHEMA =================
const STSChecklist3A3BSchema = new mongoose.Schema({

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


    // ===== TRANSFER INFO BLOCK =====
    transferInfo: TransferInfoSchema,


    // =================================================
    // ===== CHECKLIST 3A (GENERIC CHECKS 1 → 21)
    // =================================================
    checklist3A: [
        CheckItemSchema
    ],


    // =================================================
    // ===== CHECKLIST 3B (LPG / LNG ADDITIONAL)
    // =================================================
    checklist3B: [
        CheckItemSchema
    ],


    // ===== SIGNATURE =====
    signature: SignatureSchema,  // Changed from signatureBlock to signature


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

}, {
    timestamps: true
});

STSChecklist3A3BSchema.pre("save", async function () {

    if (!this.isNew || this.sequenceNumber) return;

    const year = new Date(
        this.documentInfo?.issueDate ||
        this.transferInfo?.transferDate ||
        Date.now()
    ).getFullYear();

    const counter = await FormCounterStsCheckList.findOneAndUpdate(
        {
            key: "STS_CHECKLIST_OPS-OFD-003",
            year
        },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    const padded = String(counter.seq).padStart(3, "0");

    this.sequenceNumber = `${year}-${padded}`;
});


export default mongoose.models.STSChecklist3A3B ||
    mongoose.model("STSChecklist3A3B", STSChecklist3A3BSchema);