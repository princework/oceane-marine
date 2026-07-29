import mongoose from "mongoose";
import qhseArchivePlugin from "../../plugins/qhseArchivePlugin.js";
import qhseRevisionPlugin from "../../plugins/qhseRevisionPlugin.js";
import { getNextYearwiseSerial } from "../YearwiseSerialCounter";
import { getQhseFormCode } from "../../../constants/qhse-form-codes";

const EquipmentItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // e.g. "3.3mx6.5m"
    quantityInUse: { type: Number, default: 0 },
    quantitySpare: { type: Number, default: 0 },
    additionalComments: { type: String },
    overallCondition: {
      type: String,
      enum: ["Good", "Average", "Poor", "Not Assessed"],
      default: "Not Assessed",
    },
  },
  { _id: false }
);

/* ===========================
   EQUIPMENT CATEGORY
=========================== */
const EquipmentCategorySchema = new mongoose.Schema(
  {
    categoryName: {
      type: String,
      required: true, // FENDERS, HOSES, PPE, etc.
    },
    subCategory: {
      type: String, // CARGO / VAPOUR (optional)
    },
    items: [EquipmentItemSchema],
  },
  { _id: false }
);

/* ===========================
   MAIN SCHEMA
=========================== */
const STSEquipmentBaseStockSchema = new mongoose.Schema(
  {
    /** Fixed form code (e.g. QAF-OFD-013) */
    formCode: { type: String },

    /** Year-wise document serial: YYYY-NNN (e.g. 2026-001) */
    serialNumber: { type: String },

    /** Year used for serial generation and list filtering */
    year: { type: Number },

    version: {
      type: String,
      default: "1.0",
    },

    revisionDate: {
      type: Date,
    },

    equipmentCategories: [EquipmentCategorySchema],
    status: {
      type: String,
      enum: ["DRAFT", "PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },


    filledBy: {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      name: String,
      roleAtSubmission: String,
    },

    /* ---------- Approval (Read-only) ---------- */
    approvedBy: {
      name: String,
      designation: String, // CEO / Director
      approvedDate: Date,
    },

    /* ---------- Audit ---------- */
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

/* ===========================
   FORM CODE GENERATOR
=========================== */
STSEquipmentBaseStockSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      if (!this.formCode) {
        this.formCode = getQhseFormCode("STS_EQUIPMENT_BASE_STOCK") || null;
      }
      if (!this.serialNumber) {
        this.serialNumber = await getNextYearwiseSerial(
          "STS_EQUIPMENT_BASE_STOCK",
          this.year
        );
      }
    }
  } catch (err) {
    console.error("STS Equipment Base Stock Pre-Save Error:", err);
    throw err;
  }
});

/* ===========================
   VERSION INCREMENT ON EDIT
=========================== */
STSEquipmentBaseStockSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();

  if (update?.$set) {
    update.$set.updatedAt = new Date();
  }

  if (update?.$incVersion) {
    this.updateOne({}, { $set: { version: update.$incVersion } });
  }

  next();
});


STSEquipmentBaseStockSchema.plugin(qhseArchivePlugin);
STSEquipmentBaseStockSchema.plugin(qhseRevisionPlugin);

export default mongoose.models.STSEquipmentBaseStock ||
  mongoose.model("STSEquipmentBaseStock", STSEquipmentBaseStockSchema);
