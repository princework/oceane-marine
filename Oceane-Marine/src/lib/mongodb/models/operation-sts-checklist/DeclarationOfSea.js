import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";


const ChecklistItemSchema = new mongoose.Schema({
    checklistCode: {
        type: String, // Example: 3A, 3B, 4A
        required: true
    },
    description: {
        type: String,
        required: true
    },
    selection: {
        type: String,
        enum: [
            "CONSTANT_HEADING",
            "MANOEUVRING",
            "NOT_APPLICABLE"
        ],
        required: true
    }
}, { _id: false });


const ShipSignatureSchema = new mongoose.Schema({
    name: String,
    rank: String,
    signature: String, // store image url or base64
    date: Date,
    time: String
}, { _id: false });


const STSDeclarationSchema = new mongoose.Schema({

    // ===== Document Info =====
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


    formNo: {
        type: String,
        default: "OPS-OFD-005E"
    },
    revisionNo: String,
    revisionDate: Date,
    issueDate: Date, // Keep for backward compatibility
    approvedBy: String,
    page: String,

    // ===== Ship Names (user fills these) =====
    constantHeadingShipName: {
        type: String,
        default: ""
    },
    manoeuvringShipName: {
        type: String,
        default: ""
    },

    // ===== Ship Type Selection =====
    shipOperationType: {
        type: String,
        enum: [
            "CONSTANT_HEADING_OR_BERTHED",
            "MANOEUVRING_OR_OUTER",
            ""  // Allow empty string - user fills ship names directly
        ],
        default: ""  // Optional - user fills ship names directly
    },

    // ===== Declaration Agreement =====
    declarationAccepted: {
        type: Boolean,
        default: true
    },

    // ===== Checklist Table =====
    checklists: [ChecklistItemSchema],

    // ===== Repetitive Check Interval =====
    repetitiveCheckHours: {
        type: Number
    },

    // ===== Signature Section =====
    constantHeadingShip: ShipSignatureSchema,
    manoeuvringShip: ShipSignatureSchema,

    // ===== Version & Status =====
    version: {
        type: String,
        default: "1.0"
    },
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

STSDeclarationSchema.pre("save", async function () {

    if (!this.isNew || this.sequenceNumber) return;

    const year = new Date(
        this.revisionDate || this.issueDate || Date.now()
    ).getFullYear();

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
            try {
                await FormCounterStsCheckList.createCollection();
            } catch (createError) {
                console.warn("Collection creation attempt:", createError.message);
            }
        }
    }

    const counter = await FormCounterStsCheckList.findOneAndUpdate(
        {
            key: "STS_CHECKLIST_OPS-OFD-005E",
            year
        },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    const padded = String(counter.seq).padStart(3, "0");

    this.sequenceNumber = `${year}-${padded}`;
});



export default mongoose.models.STSDeclaration ||
    mongoose.model("STSDeclaration", STSDeclarationSchema);
