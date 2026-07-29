import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";


// ================= DOCUMENT INFO =================
const DocumentInfoSchema = new mongoose.Schema({
    formNo: String,
    revisionNo: String,
    issueDate: Date,
    approvedBy: String,
}, { _id: false });


// ================= MULTI VALUE EQUIPMENT =================
const EquipmentSetSchema = new mongoose.Schema({
    values: [String] // For multiple boxes per row
}, { _id: false });


// ================= VESSEL SIDE DATA =================
const VesselSideSchema = new mongoose.Schema({

    locationSTSPosition: String,
    vesselName: String,

    arrivalDisplacement: String,
    arrivalDrafts: String,

    pblCommencementArrivalDrafts: String,
    pblCentreManifoldForwardArrival: String,
    pblCentreManifoldAftArrival: String,
    pblCompletionDepartureDrafts: String,

    maxFreeboard: String,
    minFreeboard: String,

    deadSlowAheadSpeed: String,

    bridgeWingToCentreManifoldDistance: String,

    craneCertifiedForPersonnelTransfer: Boolean,
    masterWillingIfCraneNotCertified: Boolean,

    maxCraneReachOverShipsSide: String,

    bowThrusterFitted: Boolean,

    nightBerthingAccepted: Boolean,

    cargo: String,
    quantityToTransfer: String,

    fenderSizes: EquipmentSetSchema,
    fenderSerialNumbers: EquipmentSetSchema,

    vaporHoses: EquipmentSetSchema,
    hoseSizes: EquipmentSetSchema,
    hoseSerialNumbers: EquipmentSetSchema,

    agents: String,

    otherInformation: String

}, { _id: false });


// ======================================================
// ================= MAIN SCHEMA =========================
// ======================================================

const MooringMastersJobReportSchema = new mongoose.Schema({

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


    // ===== VESSEL COMPARISON =====
    shipToBeLighted: VesselSideSchema,

    receivingShip: VesselSideSchema,


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

MooringMastersJobReportSchema.pre("save", async function () {
  // Only generate for new document
  if (!this.isNew || this.sequenceNumber) return;

  const year = new Date(
    this.documentInfo?.issueDate || Date.now()
  ).getFullYear();

  const counter = await FormCounterStsCheckList.findOneAndUpdate(
    {
      key: "STS_CHECKLIST_OPS-OFD-009",
      year
    },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const padded = String(counter.seq).padStart(3, "0");

  this.sequenceNumber = `${year}-${padded}`;
});

export default mongoose.models.MooringMastersJobReport ||
    mongoose.model(
        "MooringMastersJobReport",
        MooringMastersJobReportSchema
    );
