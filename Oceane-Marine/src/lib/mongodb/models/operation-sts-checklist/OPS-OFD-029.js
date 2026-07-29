import mongoose from "mongoose";
import FormCounterStsCheckList from "./FormCounterStsCheckList.js";


// ================= DOCUMENT INFO (form no, revision) =================
const DocumentInfoSchema = new mongoose.Schema({
    formNo: String,
    revisionNo: String,
    issueDate: Date,
    approvedBy: String,
}, { _id: false });


// ================= PERSONAL DETAILS =================
const PersonalDetailsSchema = new mongoose.Schema({
    name: String,
    country: String,
    invoiceDate: Date,
    jobNumber: String,
    operationLocation: String
}, { _id: false });


// ================= BANK DETAILS =================
const BankDetailsSchema = new mongoose.Schema({
    accountHolderName: String,
    accountNumber: String,
    ibanOrSortCode: String,
    invoiceCurrency: String
}, { _id: false });


// ================= TRAVEL RECORD =================
const TravelRecordSchema = new mongoose.Schema({
    date: Date,
    time: String,
    remarks: String
}, { _id: false });


// ================= EXPENSE ROW =================
const ExpenseRowSchema = new mongoose.Schema({
    description: String,
    numberOfDaysOrMisc: String,
    dailyRate: Number,
    amount: Number,
    officeTotal: Number
}, { _id: false });


// ================= TOTALS =================
const TotalsSchema = new mongoose.Schema({
    subTotal: Number,
    vatAmount: Number,
    grandTotal: Number
}, { _id: false });



// ================= MAIN SCHEMA =========================
const MooringMasterExpenseSheetSchema = new mongoose.Schema({
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

    personalDetails: PersonalDetailsSchema,

    bankDetails: BankDetailsSchema,


    travelDetails: {
        departureFromHomeTown: TravelRecordSchema,
        arrivalAtHomeTown: TravelRecordSchema
    },


    statementOfExpenses: [ExpenseRowSchema],


    totals: TotalsSchema,


    status: {
        type: String,
        enum: ["DRAFT", "SUBMITTED", "APPROVED", "PAID"],
        default: "DRAFT"
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }

}, { timestamps: true });

MooringMasterExpenseSheetSchema.pre("save", async function () {
  // Only generate for new document
  if (!this.isNew || this.sequenceNumber) return;

  const year = new Date(
    this.documentInfo?.issueDate || 
    this.personalDetails?.invoiceDate || 
    Date.now()
  ).getFullYear();

  const counter = await FormCounterStsCheckList.findOneAndUpdate(
    {
      key: "STS_CHECKLIST_OPS-OFD-029",
      year
    },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const padded = String(counter.seq).padStart(3, "0");

  this.sequenceNumber = `${year}-${padded}`;
});

export default mongoose.models.MooringMasterExpenseSheet ||
    mongoose.model(
        "MooringMasterExpenseSheet",
        MooringMasterExpenseSheetSchema
    );
