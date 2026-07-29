import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    seq: {
        type: Number,
        default: 0
    }
});

// Unique per form per year
counterSchema.index({ key: 1, year: 1 }, { unique: true });

export default mongoose.models.FormCounterStsCheckList ||
    mongoose.model("FormCounterStsCheckList", counterSchema);
