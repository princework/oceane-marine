import mongoose from "mongoose";

const QhseArchiveSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, index: true },
    module: { type: String, required: true, trim: true },
    documentType: { type: String, default: "", trim: true },
    formCode: { type: String, default: "", trim: true },
    title: { type: String, default: "", trim: true },
    filePath: { type: String, default: "", trim: true },
    fileUrl: { type: String, default: "", trim: true },
    originalId: { type: String, default: "", trim: true },
    archivedAt: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

QhseArchiveSchema.index({ year: 1, archivedAt: -1 });
QhseArchiveSchema.index({ year: 1, module: 1, archivedAt: -1 });

export default mongoose.models.QhseArchive ||
  mongoose.model("QhseArchive", QhseArchiveSchema);
