import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
  {
    locationName: {
      type: String,
      required: true,
      index: true,
    },

    equipmentName: {
      type: String,
      required: true,
      index: true,
    },

    equipmentType: {
      type: String,
      required: true,
      index: true,
    },

    testedBy: {
      type: String,
      required: true,
    },

    manufacturingCertificate: {
      fileUrl: {
        type: String,
        required: true,
      },
      originalFileName: String,
    },

    testCertificate: {
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
  },
  { timestamps: true }
);

export default mongoose.models.Certificate ||
  mongoose.model("Certificate", certificateSchema);
