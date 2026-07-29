import mongoose from "mongoose";

const pmsLocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
  },
  { timestamps: true }
);

pmsLocationSchema.index({ name: 1 }, { unique: true });

export default mongoose.models.PmsLocation ||
  mongoose.model("PmsLocation", pmsLocationSchema);
