import mongoose from "mongoose";

const masterStsClientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },

    /** How the record got here. Lets an admin review names auto-added from client emails. */
    source: { type: String, enum: ["MANUAL", "EMAIL_IMPORT"], default: "MANUAL" },
  },
  { timestamps: true }
);

export default mongoose.models.MasterStsClient ||
  mongoose.model("MasterStsClient", masterStsClientSchema);
