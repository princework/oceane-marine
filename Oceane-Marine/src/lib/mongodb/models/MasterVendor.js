import mongoose from "mongoose";

const masterVendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },

    /** Used to email the Due Diligence Questionnaire / Sub-Contractor Audit links. */
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address"],
    },

    isActive: { type: Boolean, default: true },

    /* ---- Sub-Contractor Audit link — last send (persists across page reloads) ---- */
    auditSentAt: { type: Date },
    auditSentTo: { type: String, trim: true },
    auditSentAuditorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MasterAuditor",
    },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== "production" && mongoose.models.MasterVendor) {
  delete mongoose.models.MasterVendor;
}

export default mongoose.models.MasterVendor ||
  mongoose.model("MasterVendor", masterVendorSchema);
