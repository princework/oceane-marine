import mongoose from "mongoose";

/** Form code options for Manual dropdown: code -> display name */
export const MANUAL_FORM_CODES = [
  { code: "BCP-OFD-03", name: "Business Continuity Plan- Manual" },
  { code: "MYM-OFD-04", name: "Maintenance and Yards Operations Manual" },
  { code: "OPM-OFD-01", name: "Operations Procedure Manual" },
  { code: "QHSE-OFD-02", name: "QHSE Management System Manual" },
];

const ManualSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
    },
    revNo: {
      type: String,
      default: "",
    },
    revDate: {
      type: Date,
    },
    formCode: {
      type: String,
      default: "",
    },
    serialNumber: {
      type: String,
      default: "",
    },
    filePath: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
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

ManualSchema.pre("save", async function () {
  try {
    if (this.isNew && !this.serialNumber) {
      const year = this.date ? new Date(this.date).getFullYear() : new Date().getFullYear();
      const formCode = this.formCode || "";
      const prefix = year + "-";
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const count = await this.constructor.countDocuments({
        formCode,
        serialNumber: new RegExp("^" + escapedPrefix),
      });
      this.serialNumber = prefix + String(count + 1).padStart(3, "0");
    }
  } catch (error) {
    console.error("Manual Pre-Save Error:", error);
    throw error;
  }
});

export default mongoose.models.Manual ||
  mongoose.model("Manual", ManualSchema);
