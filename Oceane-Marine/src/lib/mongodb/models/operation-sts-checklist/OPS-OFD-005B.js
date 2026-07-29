import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";

// ================= DOCUMENT INFO =================
const DocumentInfoSchema = new mongoose.Schema({
    formNo: String,
    revisionNo: String,
    revisionDate: Date,
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


// ================= CHECKLIST ITEM =================
const ChecklistItemSchema = new mongoose.Schema({
    clNumber: Number,
    description: String,
    status: StatusSchema,
    remarks: String
}, { _id: false });


// ================= SPECIAL PIPELINE CONDITION (CL 6A ITEM 2) =================
const PipelineConditionSchema = new mongoose.Schema({
    purged: Boolean,
    inerted: Boolean,
    depressurized: Boolean
}, { _id: false });


// ================= RESPONSIBLE PERSON BLOCK =================
const ResponsibleBlockSchema = new mongoose.Schema({
    chsOfficerName: String,
    msOfficerName: String,
    terminalName: String,
    stsSuperintendentName: String
}, { _id: false });


// ======================================================
// ================= MAIN SCHEMA =========================
// ======================================================

const STSChecklist6ABSchema = new mongoose.Schema({

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
    // ===== CHECKLIST 6A — BEFORE DISCONNECTION =====
    // =================================================
    checklist6A: {

        checks: [ChecklistItemSchema],

        pipelineConditions: PipelineConditionSchema
        // For CL 6A Row 2:
        // Purged / Inerted / Depressurized
    },


    // =================================================
    // ===== CHECKLIST 6B — BEFORE UNMOORING =====
    // =================================================
    checklist6B: [ChecklistItemSchema],


    // =================================================
    // ===== RESPONSIBLE PERSON CONFIRMATION =====
    // =================================================
    responsiblePersons: ResponsibleBlockSchema,


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

STSChecklist6ABSchema.pre("save", async function () {

    // Only generate for new document
    if (!this.isNew || this.sequenceNumber) return;

    const year = new Date(
        this.documentInfo?.revisionDate ||
        this.transferInfo?.transferDate ||
        Date.now()
    ).getFullYear();

    const counter = await FormCounterStsCheckList.findOneAndUpdate(
        {
            key: "STS_CHECKLIST_OPS-OFD-005B",
            year
        },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    const padded = String(counter.seq).padStart(3, "0");

    this.sequenceNumber = `${year}-${padded}`;
});

export default mongoose.models.STSChecklist6AB ||
    mongoose.model("STSChecklist6AB", STSChecklist6ABSchema);
