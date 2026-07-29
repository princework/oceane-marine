import mongoose from "mongoose";

const masterStsAgentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.models.MasterStsAgent ||
  mongoose.model("MasterStsAgent", masterStsAgentSchema);
