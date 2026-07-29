import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";

// ================= DOCUMENT INFO =================
const DocumentInfoSchema = new mongoose.Schema({
    formNo: String,
    revisionNo: String,
    revisionDate: Date,
    approvedBy: String,
}, { _id: false });


// ================= BASIC FORM INFO =================
const BasicInfoSchema = new mongoose.Schema({
    proposedLocation: String,
    shipName: String,
    date: Date
}, { _id: false });


// ================= GENERIC QUESTION ANSWER =================
const QAFieldSchema = new mongoose.Schema({
    itemNumber: Number,
    question: String,
    reply: mongoose.Schema.Types.Mixed
}, { _id: false });


// ================= SIGNATURE =================
const SignatureSchema = new mongoose.Schema({
    name: String,
    rank: String,
    signature: String,
    date: Date
}, { _id: false });


// ================= MAIN SCHEMA =================
const ShipStandardQuestionnaireSchema = new mongoose.Schema({

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

    // ===== BASIC DETAILS =====
    basicInfo: BasicInfoSchema,


    // =================================================
    // ================= ALL QUESTIONS ==================
    // =================================================
    responses: {

        // ===== 1 - 14 Simple Text =====
        q1: String,
        q2: String,
        q3: String,
        q4: String,
        q5: String,
        q6: String,
        q7: String,
        q8: String,
        q9: String,
        q10: String,
        q11: String,
        q12: String,
        q13: String,
        q14: String,


        // ===== 15 =====
        q15: String,


        // ===== 16 (a,b,c) =====
        q16: {
            parallelBodyArrivalDeparture: String,
            parallelDistanceAheadManifold: String,
            parallelDistanceAsternManifold: String
        },


        // ===== 17 - 20 =====
        q17: String,
        q18: String,
        q19: String,
        q20: String,


        // ===== 21 =====
        q21: String,


        // ===== 22 - 26 =====
        q22: String,
        q23: String,
        q24: String,
        q25: String,
        q26: String,


        // ===== 27 Mooring Lines Dates =====
        q27: {
            certificateDate: Date,
            putInUseDate: Date,
            lastInspectionDate: Date,
            endToEndChangeDate: Date
        },


        // ===== 28 Mooring Tails =====
        q28: {
            certificateDate: Date,
            putInUseDate: Date,
            lastInspectionDate: Date
        },


        // ===== 29 - 31 =====
        q29: String,
        q30: String,
        q31: String,


        // =================================================
        // ===== 32 MANIFOLD CONNECTION + RATES (BIG BLOCK)
        // =================================================
        q32: {

            manifoldConnectionAvailable: String,
            reducersAvailable: String,

            maxDischargeReceivingRate: {
                oneManifold: String,
                twoManifold: String
            },

            oceaneFendersRequired: String,

            maxManifoldPressureDuringTransfer: String,

            dischargeEstimatedTime: String,

            hoseThroughput: {
                hose10InGuttling: String,
                hose12InYokohama: String,
                hose8InComposite: String,
                hose10InComposite: String,
                hose12InComposite: String
            }
        },


        // =================================================
        // ===== 33 LPG ONLY =====
        // =================================================
        q33: {
            ocimfCompliance: String,
            manifoldConnections8inch: String,
            maxRate: {
                oneManifold: String,
                twoManifold: String,
                threeManifold: String
            }
        },


        // ===== 34 - 39 =====
        q34: String,
        q35: String,
        q36: String,
        q37: String,
        q38: String,
        q39: String,


        // =================================================
        // ===== 40 CARGO DETAILS BLOCK =====
        // =================================================
        q40: {
            cargoType: String,
            cargoGrade: String,
            cargoQuantity: String,
            shippers: String,
            cargoOrigin: String,
            destination: String,
            healthHazard: String,
            msdsProvided: String
        },


        // ===== 41 =====
        q41: String,


        // =================================================
        // ===== 42 PTB BLOCK =====
        // =================================================
        q42: {
            craneCertified: String,
            permissionFromOwners: String,
            oceaneFendersAllowed: String
        },


        // ===== 43 - 55 =====
        q43: String,
        q44: String,
        q45: String,
        q46: String,
        q47: String,
        q48: String,
        q49: String,
        q50: String,
        q51: String,
        q52: String,
        q53: String,
        q54: String,
        q55: String,


        // ===== 56 COVID =====
        q56: String,


        // ===== 57 SANCTION CONFIRMATION =====
        q57: String
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

}, {
    timestamps: true
});

ShipStandardQuestionnaireSchema.pre("save", async function () {

    if (!this.isNew || this.sequenceNumber) return;

    const year = new Date(
        this.documentInfo?.revisionDate ||
        this.basicInfo?.date ||
        Date.now()
    ).getFullYear();

    const counter = await FormCounterStsCheckList.findOneAndUpdate(
        {
            key: "STS_CHECKLIST_OPS-OFD-001-A",
            year
        },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    const padded = String(counter.seq).padStart(3, "0");

    this.sequenceNumber = `${year}-${padded}`;
});


export default mongoose.models.ShipStandardQuestionnaire ||
    mongoose.model(
        "ShipStandardQuestionnaire",
        ShipStandardQuestionnaireSchema
    );
