import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

// Compound unique index: key + year combination must be unique
CounterSchema.index({ key: 1, year: 1 }, { unique: true });

const Counter =
  mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

export default Counter;