import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";

// ================= CHECKLIST ITEM =================
const ChecklistItemSchema = new mongoose.Schema({
    checklist: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    terminalBerthedShip: {
        type: Boolean,
        default: false
    },
    outerShip: {
        type: Boolean,
        default: false
    },
    terminal: {
        type: Boolean,
        default: false
    },
    notApplicable: {
        type: Boolean,
        default: false
    }
}, { _id: false });

// ================= SIGNATURE BLOCK =================
const SignatureBlockSchema = new mongoose.Schema({
    name: String,
    rank: String,
    signature: {
        type: String // image url or base64
    },
    date: Date,
    time: String
}, { _id: false });

// ================= MAIN SCHEMA =================
const STSChecklistFiveFSchema = new mongoose.Schema({

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

    // ===== INITIAL INPUT FIELDS =====
    terminalBerthedShip: String,
    outerShip: String,
    terminal: String,

    // ===== CHECKLIST TABLE =====
    checklistItems: [ChecklistItemSchema],

    // ===== SIGNATURE BLOCKS =====
    terminalBerthedShipSignature: SignatureBlockSchema,
    outerShipSignature: SignatureBlockSchema,
    terminalSignature: SignatureBlockSchema,

    // ===== ADDITIONAL FIELDS =====
    repetitiveChecksInterval: String, // Hours interval for repetitive checks

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

STSChecklistFiveFSchema.pre("save", async function () {
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
        Date.now()
    ).getFullYear();

    try {
        const counter = await FormCounterStsCheckList.findOneAndUpdate(
            {
                key: "STS_CHECKLIST_OPS-OFD-005D",
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


export default mongoose.models.STSChecklistFiveF ||
    mongoose.model("STSChecklistFiveF", STSChecklistFiveFSchema);
