import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";

// ================= CHECKLIST ITEM =================
const GenericCheckSchema = new mongoose.Schema({
    clNumber: {
        type: Number,
        required: true
    },

    description: {
        type: String,
        required: true
    },

    status: {
        type: String,
        enum: ["YES", "NOT_APPLICABLE", "NO"],
        required: true
    },

    remarks: {
        type: String
    }

}, { _id: false });


// ================= SIGNATURE =================
const SignatureSchema = new mongoose.Schema({
    name: String,
    rank: String,

    signature: {
        type: String // image url or base64
    },

    date: Date

}, { _id: false });


// ================= MAIN SCHEMA =================
const STSChecklistOneSchema = new mongoose.Schema({

    // ===== DOCUMENT INFO =====
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

    formNo: String,
    revisionNo: String,
    revisionDate: Date,
    approvedBy: String,
    page: String,

    // ===== VESSEL DETAILS =====
    vesselDetails: {
        vesselName: String,
        shipOperator: String,
        charterer: String,
        stsOrganizer: String,

        plannedTransferDateTime: Date,
        transferLocation: String,
        cargo: String,

        constantHeadingOrBerthedShip: String,
        manoeuvringOrOuterShip: String,

        poacOrStsSuperintendent: String,
        applicableJointPlanOperation: String
    },

    // ===== GENERIC CHECKLIST TABLE =====
    genericChecks: [GenericCheckSchema],

    // ===== SIGNATURE =====
    signatureBlock: SignatureSchema,


    // ===== OPTIONAL WORKFLOW =====
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

STSChecklistOneSchema.pre("save", async function () {
    // Skip if not new document or sequenceNumber already exists
    if (!this.isNew || this.sequenceNumber) return;

    // Ensure MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
        throw new Error("MongoDB connection is not ready. Please connect to MongoDB before saving.");
    }

    // Ensure FormCounterStsCheckList model is initialized
    if (!FormCounterStsCheckList) {
        throw new Error("FormCounterStsCheckList model is not properly initialized");
    }

    // Ensure collection exists (first-time initialization)
    if (!FormCounterStsCheckList.collection) {
        let attempts = 0;
        const maxAttempts = 50;
        while (!FormCounterStsCheckList.collection && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        if (!FormCounterStsCheckList.collection) {
            // Try to create collection explicitly
            try {
                await FormCounterStsCheckList.createCollection();
            } catch (createError) {
                // Collection might already exist, ignore error
                console.warn("Collection creation attempt:", createError.message);
            }
        }
    }

    const year = new Date(
        this.revisionDate ||
        this.vesselDetails?.plannedTransferDateTime ||
        Date.now()
    ).getFullYear();

    try {
        const counter = await FormCounterStsCheckList.findOneAndUpdate(
            {
                key: "STS_CHECKLIST_OPS-OFD-001",
                year
            },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        if (!counter) {
            throw new Error("Failed to create or update counter");
        }

        const padded = String(counter.seq).padStart(3, "0");
        this.sequenceNumber = `${year}-${padded}`;
    } catch (error) {
        console.error("Error generating sequence number:", error);
        throw error;
    }
});


export default mongoose.models.STSChecklistOne ||
    mongoose.model("STSChecklistOne", STSChecklistOneSchema);
