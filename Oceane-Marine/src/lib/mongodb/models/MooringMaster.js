import mongoose from "mongoose";

const mooringMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    /** Used to email STS checklist links to the mooring master assigned to an operation. */
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address"],
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
