import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";


// ================= DOCUMENT INFO (form no, revision) =================
const DocumentInfoSchema = new mongoose.Schema({
    formNo: String,
    revisionNo: String,
    issueDate: Date,
    approvedBy: String,
}, { _id: false });


// ================= TRANSFER HEADER =================
const TransferHeaderSchema = new mongoose.Schema({

    dischargingShipName: String,

    receivingShipName: String,

    transferStartDate: Date,

    jobNumber: String

}, { _id: false });


// ================= HOURLY RECORD ROW =================
const HourlyRecordSchema = new mongoose.Schema({

    serialNumber: Number,

    date: Date,

    time: String, // HH:mm

    dischargedQuantity: Number,

    receivedQuantity: Number,

    differenceQuantity: Number,

    checkedBy: String, // name or signature url

}, { _id: false });


// ======================================================
// ================= MAIN SCHEMA =========================
// ======================================================

const STSHourlyQuantityLogSchema = new mongoose.Schema({
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

    transferInfo: TransferHeaderSchema,

    hourlyRecords: [HourlyRecordSchema],


    status: {
        type: String,
        enum: ["DRAFT", "SUBMITTED", "FINALIZED"],
        default: "DRAFT"
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }

}, { timestamps: true });

STSHourlyQuantityLogSchema.pre("save", async function () {
  // Only generate for new document
  if (!this.isNew || this.sequenceNumber) return;

  const year = new Date(
    this.documentInfo?.issueDate || 
    this.transferInfo?.transferStartDate || 
    Date.now()
  ).getFullYear();

  const counter = await FormCounterStsCheckList.findOneAndUpdate(
    {
      key: "STS_CHECKLIST_OPS-OFD-015",
      year
    },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const padded = String(counter.seq).padStart(3, "0");

  this.sequenceNumber = `${year}-${padded}`;
});

export default mongoose.models.STSHourlyQuantityLog ||
    mongoose.model(
        "STSHourlyQuantityLog",
        STSHourlyQuantityLogSchema
    );
