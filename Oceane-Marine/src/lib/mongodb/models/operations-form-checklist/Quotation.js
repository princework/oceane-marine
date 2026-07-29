import mongoose from "mongoose";
import Counter from "../generateFormCode";

const QuotationSchema = new mongoose.Schema(
  {
    formCode: {
      type: String,
      unique: true,
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
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

QuotationSchema.pre("save", async function () {
  try {
    if (this.isNew && !this.formCode) {
      const counter = await Counter.findOneAndUpdate(
        { key: "QUOTATION" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.formCode = `OPS-QUO-${String(counter.seq).padStart(3, "0")}`;
    }
  } catch (error) {
    console.error("Quotation Pre-Save Error:", error);
    throw error;
  }
});

export default mongoose.models.Quotation ||
  mongoose.model("Quotation", QuotationSchema);

