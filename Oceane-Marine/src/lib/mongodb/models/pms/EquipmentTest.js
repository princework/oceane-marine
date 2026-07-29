import mongoose from "mongoose";

const equipmentTestSchema = new mongoose.Schema(
  {
    equipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipment",
      required: true,
      index: true
    },

    tester: {
      type: String,
      required: true
    },

    plannedOn: {
      type: Date,
      required: true
    },

    testDate: {
      type: Date
    },

    status: {
      type: String,
      enum: ["PLANNED", "COMPLETED", "CANCELLED", "OVERDUE"],
      default: "PLANNED",
      index: true
    },

    remarks: String,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

equipmentTestSchema.index({ equipment: 1, plannedOn: -1 });

export default mongoose.models.EquipmentTest ||
  mongoose.model("EquipmentTest", equipmentTestSchema);
