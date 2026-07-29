import mongoose from "mongoose";

const mooringMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    availabilityStatus: {
      type: String,
      enum: ["AVAILABLE", "ASSIGNED"],
      default: "AVAILABLE",
    },

    currentOperation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StsOperation",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.models.MooringMaster ||
  mongoose.model("MooringMaster", mooringMasterSchema);
