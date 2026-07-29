import mongoose from "mongoose";

const attachmentSchema = {
  filePath: { type: String, default: "" },
  originalFileName: { type: String, default: "" },
  mimeType: { type: String, default: "" },
  fileSize: { type: Number },
};

/** User-managed controlled documents (form + file); Rev No is manual (revMajor.revMinor). */
const ControlledDocumentEntrySchema = new mongoose.Schema(
  {
    formCode: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    /** Count of related / attached documents (register-style “Documents” column). */
    documents: { type: Number, default: 0, min: 0 },
    issueDate: { type: Date },
    /** Display as `${revMajor}.${revMinor}` — create 1.0; each PATCH bumps revMinor. */
    revMajor: { type: Number, default: 1 },
    revMinor: { type: Number, default: 0 },
    department: { type: String, trim: true, default: "" },
    attachment: attachmentSchema,
  },
  { timestamps: true }
);

ControlledDocumentEntrySchema.index({ updatedAt: -1 });

if (mongoose.models.ControlledDocumentEntry) {
  mongoose.deleteModel("ControlledDocumentEntry");
}

export default mongoose.model("ControlledDocumentEntry", ControlledDocumentEntrySchema);
