import mongoose from "mongoose";

/**
 * A log entry for one checklist form flagged by an admin as needing correction,
 * created when the "Send for Correction" email goes out. One document per form
 * per send — the email itself carries the pre-filled update link; this record
 * is purely the audit trail (who asked for what, sent to whom, when).
 */
const formCorrectionRequestSchema = new mongoose.Schema(
  {
    operationRef: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    formNo: {
      type: String,
      required: true,
      trim: true,
    },

    formTitle: {
      type: String,
      default: "",
    },

    comment: {
      type: String,
      required: true,
      trim: true,
    },

    requestedBy: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
    },

    sentTo: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
    },

    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.models.FormCorrectionRequest ||
  mongoose.model("FormCorrectionRequest", formCorrectionRequestSchema);
