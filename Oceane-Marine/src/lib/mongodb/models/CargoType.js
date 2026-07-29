import mongoose from "mongoose";

const cargoTypeSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.models.CargoType ||
  mongoose.model("CargoType", cargoTypeSchema);
