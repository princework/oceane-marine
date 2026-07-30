import mongoose from "mongoose";

const masterStsAgentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },

    /** How the record got here. Lets an admin review names auto-added from client emails. */
    source: { type: String, enum: ["MANUAL", "EMAIL_IMPORT"], default: "MANUAL" },
  },
  { timestamps: true }
);

export default mongoose.models.MasterStsAgent ||
  mongoose.model("MasterStsAgent", masterStsAgentSchema);
