import mongoose from "mongoose";

const WarehouseManagementSchema = new mongoose.Schema(
  {
    /* =========================
       STATUS (TOP OF FORM)
    ========================== */
    status: {
      type: String,
      enum: ["COMPLETED", "NOT_COMPLETED"],
      default: "NOT_COMPLETED",
    },

    /* =========================
       LOCATION (PMS Location master — names from admin Location tab)
    ========================== */
    location: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    /* =========================
       EQUIPMENT INFO (DROPDOWNS)
    ========================== */
    equipment: { type: String, trim: true, required: true },
    equipmentType: { type: String, trim: true },
    specification: { type: String, trim: true },

    /* =========================
       INVENTORY SUMMARY
    ========================== */
    primaryFenders: { type: Number, default: 0 },
    secondaryFenders: { type: Number, default: 0 },
    hoses: { type: Number, default: 0 },
    /** Free-text description of any extra/spare equipment beyond the counted items above. */
    additionalEquipments: { type: String, trim: true, default: "" },

    ownership: {
      type: String,
      enum: ["OWNED", "THIRD_PARTY"],
      required: true,
    },

    /* =========================
       EQUIPMENT MOVEMENT
    ========================== */
    nos: { type: Number, min: 0, required: true },

    startDate: Date,
    estimatedEndDate: Date,

    fromLocation: { type: String, trim: true },
    stopover: { type: String, trim: true },
    toLocation: { type: String, trim: true },

    /* =========================
       ATTACHMENTS (LOCAL FILES)
    ========================== */
    attachments: [
      {
        fileName: String,
        filePath: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    /* =========================
       REMARKS
    ========================== */
    remarks: { type: String, trim: true },

    /* =========================
       SYSTEM
    ========================== */
    isDeleted: { type: Boolean, default: false },

    /** Dedupe: `estimatedEndDate` (UTC day) we last sent the overdue email for */
    pmsWarehouseEndOverdueEmailSentForEstimatedEndDate: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.WarehouseManagement ||
  mongoose.model("WarehouseManagement", WarehouseManagementSchema);
