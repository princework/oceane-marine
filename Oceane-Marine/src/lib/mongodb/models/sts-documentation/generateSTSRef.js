import Counter from "@/lib/mongodb/models/generateFormCode";
import { formatStsOperationRef } from "@/lib/operations/formatStsOperationRef";

export async function generateSTSRef(operationStartTime) {
  const year = new Date(operationStartTime).getFullYear();

  const counter = await Counter.findOneAndUpdate(
    { key: "STS_OPERATION", year },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return formatStsOperationRef(year, counter.seq);
}
