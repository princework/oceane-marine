import mongoose from "mongoose";

const masterAuditorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },

    /** Used to email the Sub-Contractor Audit link — the auditor fills it on-site, not the vendor. */
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address"],
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== "production" && mongoose.models.MasterAuditor) {
  delete mongoose.models.MasterAuditor;
}

export default mongoose.models.MasterAuditor ||
  mongoose.model("MasterAuditor", masterAuditorSchema);
