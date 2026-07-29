import mongoose from "mongoose";

const ControlledDocumentRegisterSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, index: true },
    rowOrder: { type: Number, default: 0 },
    formCode: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    version: { type: String, default: "", trim: true },
    effectiveDate: { type: String, default: "", trim: true },
    lastRevisedDate: { type: String, default: "", trim: true },
    author: { type: String, default: "", trim: true },
    department: { type: String, default: "QHSE", trim: true },
    revisionNumber: { type: String, default: "", trim: true },
    format: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

export default mongoose.models.ControlledDocumentRegister ||
  mongoose.model("ControlledDocumentRegister", ControlledDocumentRegisterSchema);
