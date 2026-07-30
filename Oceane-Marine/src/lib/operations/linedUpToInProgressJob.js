import { connectDB } from "@/lib/config/connection";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";

/**
 * Flips operations from "Lined Up" to "INPROGRESS" once their start date/time
 * has arrived. Runs on a schedule (see cron-jobs/src/jobs/operationsLinedUpToInProgress.js)
 * so operations approved ahead of time (via the Transfer Location Questionnaire
 * approval) automatically become active without manual intervention.
 */
export async function runLinedUpToInProgressJob() {
  await connectDB();

  const now = new Date();
  const candidates = await StsOperation.find({
    operationStatus: "Lined Up",
    isLatest: true,
    operationStartTime: { $lte: now },
  });

  let updated = 0;
  for (const operation of candidates) {
    operation.operationStatus = "INPROGRESS";
    await operation.save();
    updated += 1;
  }

  return { success: true, checked: candidates.length, updated };
}
