import mongoose from "mongoose";

const ManualFormCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.ManualFormCode ||
  mongoose.model("ManualFormCode", ManualFormCodeSchema);
