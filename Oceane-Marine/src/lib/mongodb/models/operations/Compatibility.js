import mongoose from "mongoose";

const shipSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    DWT: { type: Number, default: 0 },
    Beam: { type: Number, default: 0 },
    DISP: { type: Number, default: 0 },
    Draft: { type: Number, default: 0 },
    MaxFreeboard: { type: Number, default: 0 },
    MinFreeboard: { type: Number, default: 0 },
    ManifoldToRail: { type: Number, default: 0 },
  },
  { _id: false }
);

const CompatibilitySchema = new mongoose.Schema(
  {
    operationRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StsOperation",
    },
    operationNumber: { type: String, required: true },
    year: { type: Number, required: true },
    location: {
      locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
      name: { type: String, default: "" },
    },
    STBL: { type: shipSchema, default: () => ({}) },
    SS: { type: shipSchema, default: () => ({}) },
    results: {
      hose: {
        MaxFreeboard: Number,
        MinFreeboard: Number,
        FreeboardDiff: Number,
        HoseCal: Number,
      },
      fender: {
        EDC: Number,
        STBLMassCoeff: Number,
        SSMassCoeff: Number,
        VirtDispSTBL: Number,
        VirtDispSS: Number,
        CVD: Number,
        V_Calm: Number,
        V_Moderate: Number,
        V_Rough: Number,
        EnergyCoeff_Calm: Number,
        EnergyCoeff_Moderate: Number,
        EnergyCoeff_Rough: Number,
        Fenderselect_Calm: String,
        Fenderselect_Moderate: String,
        Fenderselect_Rough: String,
      },
    },
  },
  { timestamps: true }
);

CompatibilitySchema.index({ year: 1, "location.locationId": 1 });
CompatibilitySchema.index({ operationNumber: 1 });

export default mongoose.models.Compatibility || mongoose.model("Compatibility", CompatibilitySchema);
