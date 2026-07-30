import mongoose from "mongoose";

const masterStsClientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },

    /** Used to email the Transfer Location Questionnaire link to this client. */
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address"],
    },

    /** How the record got here. Lets an admin review names auto-added from client emails. */
    source: { type: String, enum: ["MANUAL", "EMAIL_IMPORT"], default: "MANUAL" },
  },
  { timestamps: true }
);

export default mongoose.models.MasterStsClient ||
  mongoose.model("MasterStsClient", masterStsClientSchema);
