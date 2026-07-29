import mongoose from "mongoose";

const statutoryCertificateSchema = new mongoose.Schema(
  {
    location: {
      type: String,
      required: true,
      index: true,
    },
    typeOfDocs: {
      type: String,
      required: true,
      index: true,
    },
    year: {
      type: String,
      required: true,
      index: true,
    },
    validity: {
      type: Date,
      required: true,
    },
    attachment: {
      fileUrl: {
        type: String,
        required: true,
      },
      originalFileName: String,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },

    /** Cron dedupe: 30-day-prior expiry email sent for this `validity` (UTC day) */
    hrStatutoryReminder30dSentForValidity: { type: Date, default: null },

    /** Cron dedupe: 15-day-prior expiry email sent for this `validity` (UTC day) */
    hrStatutoryReminder15dSentForValidity: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.StatutoryCertificate ||
  mongoose.model("StatutoryCertificate", statutoryCertificateSchema);
