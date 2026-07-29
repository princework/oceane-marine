import mongoose from "mongoose";

const filePermissionSchema = new mongoose.Schema({
  operationId: { type: mongoose.Schema.Types.ObjectId },
  documentId: { type: mongoose.Schema.Types.ObjectId },
  documentType: String,
  canEdit: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
  canUpload: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },

    email: { type: String, unique: true },
    password: { type: String, required: true },

    roles: {
      type: [String],
      enum: ["ADMIN", "REVIEWER", "EDITOR", "UPLOADER", "CUSTOM_EDITOR"],
      default: ["REVIEWER"],
    },

    operationsRole: {
      type: String,
      enum: ["admin", "editor", "approver", "viewer"],
      default: "viewer",
    },

    hrRole: {
      type: String,
      enum: ["admin", "editor", "approver", "viewer"],
      default: "viewer",
    },

    pmsRole: {
      type: String,
      enum: ["admin", "editor", "approver", "viewer"],
      default: "viewer",
    },

    qhseRole: {
      type: String,
      enum: ["admin", "editor", "approver", "viewer"],
      default: "viewer",
    },

    permissions: {
      operations: {
        reviewer: { type: Boolean, default: false },
        create: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
      },
      documents: {
        reviewer: { type: Boolean, default: false },
        upload: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
        download: { type: Boolean, default: false },
      },
    },

    filePermissions: [filePermissionSchema],

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", userSchema);
