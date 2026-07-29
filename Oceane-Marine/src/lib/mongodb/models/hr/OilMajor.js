import mongoose from "mongoose";

const oilMajorSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["Approved", "Counterparty STS service provider", "In Progress"],
      required: true,
      default: "In Progress",
    },
    attachments: [
      {
        fileUrl: { type: String, default: "" },
        originalFileName: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

// Force re-register on hot reload
delete mongoose.models.OilMajor;

export default mongoose.model("OilMajor", oilMajorSchema);
