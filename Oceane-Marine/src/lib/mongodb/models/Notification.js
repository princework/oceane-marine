import mongoose from "mongoose";

const NOTIFICATION_ACTIONS = ["CREATE", "EDIT", "DELETE"];

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    action: {
      type: String,
      enum: NOTIFICATION_ACTIONS,
      required: true,
    },
    module: {
      type: String,
      required: true,
      index: true,
    },
    submodule: { type: String, default: "" },
    recordId: { type: String, default: "" },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ isRead: 1, createdAt: -1 });
notificationSchema.index({ module: 1, createdAt: -1 });

export default mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);
