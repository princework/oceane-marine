import mongoose from "mongoose";

const masterStsClientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.models.MasterStsClient ||
  mongoose.model("MasterStsClient", masterStsClientSchema);
