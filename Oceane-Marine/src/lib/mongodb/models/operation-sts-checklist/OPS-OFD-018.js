import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";


// ================= DOCUMENT INFO =================
const DocumentInfoSchema = new mongoose.Schema({
    formNo: String,
    revisionNo: String,
    issueDate: Date,
    approvedBy: String,
    page: String
}, { _id: false });


// ================= BASIC INFO =================
const BasicInfoSchema = new mongoose.Schema({
    stsSuperintendent: String,
    jobNumber: String,

    receivingVessel: String,
    dischargingVessel: String,

    supportCraftMobDemob: String,

    location: String
}, { _id: false });


// ================= TIMING ROW =================
const TimingRowSchema = new mongoose.Schema({
    activityName: String,

    fromDate: Date,
    fromTime: String,

    toDate: Date,
    toTime: String,

    remarks: String
}, { _id: false });


// ================= WEATHER DELAY =================
const WeatherDelaySchema = new mongoose.Schema({
    sea: String,
    swell: String,
    wind: String,
    totalExposureHours: Number
}, { _id: false });


// ================= CARGO INFO =================
const CargoInfoSchema = new mongoose.Schema({
    cargoName: String,
    cargoQuantity: String,
    cargoPumpingTime: String
}, { _id: false });


// ======================================================
// ================= MAIN SCHEMA =========================
// ======================================================

const STSTimesheetSchema = new mongoose.Schema({

    // HEADER
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

    // BASIC DETAILS
    basicInfo: BasicInfoSchema,


    // MAIN TIMINGS TABLE
    operationTimings: [TimingRowSchema],


    // ADDITIONAL ACTIVITY TABLE
    additionalActivities: [TimingRowSchema],


    // WEATHER DELAY
    weatherDelay: WeatherDelaySchema,


    // CARGO INFO
    cargoInfo: CargoInfoSchema,


    // FINAL REMARKS
    finalRemarks: String,


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

STSTimesheetSchema.pre("save", async function () {
  // Only generate for new document
  if (!this.isNew || this.sequenceNumber) return;

  const year = new Date(
    this.documentInfo?.issueDate || Date.now()
  ).getFullYear();

  const counter = await FormCounterStsCheckList.findOneAndUpdate(
    {
      key: "STS_CHECKLIST_OPS-OFD-018",
      year
    },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const padded = String(counter.seq).padStart(3, "0");

  this.sequenceNumber = `${year}-${padded}`;
});

export default mongoose.models.STSTimesheet ||
    mongoose.model("STSTimesheet", STSTimesheetSchema);
