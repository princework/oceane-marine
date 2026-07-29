import mongoose from "mongoose";

const StsQuotationFormSchema = new mongoose.Schema(
  {
    formType: {
      type: String,
      required: true,
      enum: ["OPS-OFD-030", "OPS-OFD-030B", "POAC"],
    },
    // Common fields (both forms)
    clientName: { type: String, default: "" },
    attn: { type: String, default: "" },
    proposalDate: { type: Date, default: null },
    projectName: { type: String, default: "" },
    formNo: { type: String, default: "" },
    issueDate: { type: Date, default: null },

    // OPS-OFD-030 (STS Job) fields
    jobRef: { type: String, default: "" },
    dischargingShip: { type: String, default: "" },
    receivingShip: { type: String, default: "" },
    operationDate: { type: Date, default: null },
    location: { type: String, default: "" },
    cargo: { type: String, default: "" },
    quantity: { type: String, default: "" },
    quantityUnit: { type: String, default: "BBLS" },
    lumpSum: { type: String, default: "" },
    thereafter: { type: String, default: "" },
    freeTime: { type: String, default: "" },
    availability: { type: String, default: "" },
    paymentTerms: { type: String, default: "" },
    primaryFenders: { type: String, default: "" },
    secondaryFenders: { type: String, default: "" },
    fenderMoorings: { type: String, default: "" },
    hoses: { type: String, default: "" },
    supportCraft: { type: String, default: "" },
    personnelTransferBasket: { type: String, default: "" },
    baseInfoLocation: { type: String, default: "" },
    // Acceptance (030) — image stored under public/signature/operations/sts-checklist-ops-ofd-030/… (same pattern as other STS forms)
    acceptanceClientName: { type: String, default: "" },
    personInCharge: { type: String, default: "" },
    acceptanceDate: { type: Date, default: null },
    acceptanceSignatureText: { type: String, default: "" },
    acceptanceSignatureImage: { type: String, default: "" },

    // OPS-OFD-030B (STS Advisor): section 1.1 Service Overview locations in PDF
    serviceOverviewFrom: { type: String, default: "" },
    serviceOverviewTo: { type: String, default: "" },

    // OPS-OFD-030B (STS Advisor) fields
    designatedAdvisor: { type: String, default: "" },
    dailyRate: { type: String, default: "" },
    managementFee: { type: String, default: "" },
    flightsTravel: { type: String, default: "" },
    localLogistics: { type: String, default: "" },
    communicationCharges: { type: String, default: "" },
    // Acceptance (030B)
    acceptanceName: { type: String, default: "" },
    acceptanceAddress: { type: String, default: "" },
    acceptanceEmail: { type: String, default: "" },
    acceptanceTelephone: { type: String, default: "" },
    authorizedSignatoryFor: { type: String, default: "" },
    acceptanceDate030B: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.models.StsQuotationForm ||
  mongoose.model("StsQuotationForm", StsQuotationFormSchema);
