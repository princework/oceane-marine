import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";

// ================= DOCUMENT INFO =================
const DocumentInfoSchema = new mongoose.Schema({
    formNo: String,
    revisionNo: String,
    revisionDate: Date,
    approvedBy: String,
    page: String
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


// ================= STATUS (CHS + MS) =================
const DualStatusSchema = new mongoose.Schema({
    chs: Boolean,
    ms: Boolean,
    notApplicable: Boolean,
    remarks: String
}, { _id: false });


// ================= GENERIC CHECK ITEM =================
const GenericCheckSchema = new mongoose.Schema({
    clNumber: Number,
    description: String,
    status: DualStatusSchema
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

const STSChecklist4AFSchema = new mongoose.Schema({

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
    // ===== CL 4A GENERIC CHECKS =====
    // =================================================
    checklist4A: {
        checks: [GenericCheckSchema],

        simops: {
            nitrogenPurgingOrInerting: DualStatusSchema,
            repairsMaintenance: DualStatusSchema,
            tankCleaning: DualStatusSchema,
            cow: DualStatusSchema,
            slopsDischarge: DualStatusSchema,
            wasteDischarge: DualStatusSchema,
            bunkering: DualStatusSchema,
            receivingStores: DualStatusSchema,
            personnelTransfer: DualStatusSchema,
            crewChange: DualStatusSchema,
            plannedDrills: DualStatusSchema
        }
    },


    // =================================================
    // ===== CL 4B VAPOUR BALANCING =====
    // =================================================
    checklist4B: {

        checks: [GenericCheckSchema],

        pvDevices: {
            liquidPVBreaker: String,
            tankPVValves: String,
            mastHeadPVValves: String,
            otherPVDevices: String
        },

        pressureSettings: {
            maxPressureDifferential: String,
            cargoTankPressureRange: String,

            cargoTankPressureAlarm: {
                high: String,
                low: String
            },

            igMainPressureAlarm: {
                high: String,
                low: String
            },

            vapourEmissionPressureAlarm: {
                high: String,
                low: String
            }
        },

        oxygenAnalyserChecked: DualStatusSchema,

        transferSequenceAgreement: {
            normalStartUp: Boolean,
            normalShutdown: Boolean,
            lowVapourPressureAlarm: Boolean,
            highVapourPressureAlarm: Boolean
        }
    },


    // =================================================
    // ===== CL 4C CHEMICAL TANKER =====
    // =================================================
    checklist4C: [GenericCheckSchema],


    // =================================================
    // ===== CL 4D LPG / LNG =====
    // =================================================
    checklist4D: [GenericCheckSchema],


    // =================================================
    // ===== CL 4E LNG =====
    // =================================================
    checklist4E: {
        esdErsArrangementsTested: DualStatusSchema,
        cargoLinesNitrogenPurged: DualStatusSchema,
        connectionsLeakTested: DualStatusSchema,
        nitrogenPlantOperational: DualStatusSchema,
        waterCurtainRunning: DualStatusSchema
    },


    // =================================================
    // ===== CL 4F PRE TRANSFER AGREEMENTS =====
    // =================================================
    checklist4F: {

        jpo: {
            latestVersion: String,
            dateVersion: String
        },

        workingLanguage: String,

        agreedSIMOPS: Boolean,

        shipsReadyForManoeuvring: {
            notApplicableForHeadingShips: Boolean,
            noticePeriod: String,
            ship1Minutes: String,
            ship2Minutes: String
        },

        communicationSystem: {
            primarySystem: String,
            backupSystem: String
        },

        operationalSupervision: {
            ship1Responsible: String,
            ship2Responsible: String,
            terminalResponsible: String
        },

        smokingRestrictions: {
            ship1Restrictions: String,
            ship2Restrictions: String,
            terminalRestrictions: String
        },

        stopCargoTransfer: String,

        environmentalLimits: {
            maxWindSpeed: String,
            current: String,
            swell: String,
            disconnect: String,
            unmooring: String
        },

        cargoBallastLimits: {
            maxTransferRates: String,
            toppingOffRates: String,
            maxManifoldPressure: String,
            cargoTemperature: String,
            otherLimitations: String
        },

        pressureSurgeControl: {
            loadingShip: String,
            minCargoTanksOpen: String,
            tankSwitchingProtocols: String,
            fullLoadRate: String,
            toppingOffRate: String,
            closingTimeAutoValves: String
        },

        cargoTransferManagement: {
            actionNoticePeriods: String,
            transferStopProtocols: String
        },

        routineChecks: {
            routineQuantityChecks: String
        },

        emergencySignals: {
            ship1Signal: String,
            ship2Signal: String,
            terminalSignal: String
        },

        tankSystem: {
            ship1System: String,
            ship2System: String
        },

        closedOperations: {
            notApplicable: Boolean,
            requirements: String
        },

        esdOilChemical: {
            notApplicable: Boolean,
            confirmSystem: String
        },

        esdErsLpgLng: {
            notApplicable: Boolean,
            fibreOpticLink: String,
            closingTimeUnloadingSeconds: String,
            closingTimeLoadingSeconds: String,
            ersAvailable: Boolean
        },

        vapourBalancingEmergency: {
            notApplicable: Boolean,
            ventVesselIfNeeded: String
        }
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

STSChecklist4AFSchema.pre("save", async function () {

    // Only generate for new document
    if (!this.isNew || this.sequenceNumber) return;

    const year = new Date().getFullYear();

    const counter = await FormCounterStsCheckList.findOneAndUpdate(
        {
            key: "STS_CHECKLIST_OPS-OFD-004",
            year
        },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    const padded = String(counter.seq).padStart(3, "0");

    this.sequenceNumber = `${year}-${padded}`;
});

export default mongoose.models.STSChecklist4AF ||
    mongoose.model("STSChecklist4AF", STSChecklist4AFSchema);
