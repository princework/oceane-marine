import mongoose from "mongoose";

const cidSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      index: true,
    },
    location: {
      type: String,
      required: true,
      index: true,
    },
    validity: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    /** Set when 5-day CID expiry reminder was sent (dedupe per validity date) */
    lastCidExpiryReminder5dAt: { type: Date },
    lastCidExpiryReminder5dValidity: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.Cid || mongoose.model("Cid", cidSchema);
