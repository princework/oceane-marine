import mongoose from "mongoose";

/**
 * Counter for year-wise serial numbers (e.g. 2026-001, 2026-002, 2027-001).
 * Each module has a key; seq increments per year. Serial format: YYYY-NNN.
 */
const YearwiseSerialCounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    year: { type: Number, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: false }
);

YearwiseSerialCounterSchema.index({ key: 1, year: 1 }, { unique: true });

const YearwiseSerialCounter =
  mongoose.models.YearwiseSerialCounter ||
  mongoose.model("YearwiseSerialCounter", YearwiseSerialCounterSchema);

/**
 * Returns the next serial number for the given module key in format YYYY-NNN.
 * @param {string} moduleKey - e.g. "STS_BASE_AUDIT", "NEW_BASE_SETUP", "POAC_CROSS_COMPETENCY"
 * @param {number} [year] - Optional year for the serial (e.g. from a form date). Defaults to current year.
 * @returns {Promise<string>} - e.g. "2026-001"
 */
export async function getNextYearwiseSerial(moduleKey, year) {
  const yearNum =
    year != null && !Number.isNaN(Number(year))
      ? Number(year)
      : new Date().getFullYear();
  const doc = await YearwiseSerialCounter.findOneAndUpdate(
    { key: moduleKey, year: yearNum },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${yearNum}-${String(doc.seq).padStart(3, "0")}`;
}

export default YearwiseSerialCounter;
