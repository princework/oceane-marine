import mongoose from "mongoose";
import Counter from "../generateFormCode";

const InspectionChecklistSchema = new mongoose.Schema(
  {
    formCode: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    version: {
      type: String,
      required: true,
      default: "1.0",
    },
    date: {
      type: Date,
      required: true,
    },
    uploadedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      name: {
        type: String,
      },
    },
    location: {
      locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Location",
      },
      name: {
        type: String,
      },
    },
    year: {
      type: Number,
      // Only required for form 013
    },
    boatName: {
      type: String,
      // Only required for form 013
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// formCode will be set from formNumber in the API route, not auto-generated

export default mongoose.models.InspectionChecklist ||
  mongoose.model("InspectionChecklist", InspectionChecklistSchema);

