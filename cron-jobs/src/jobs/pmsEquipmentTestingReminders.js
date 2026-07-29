import { triggerJob } from "../lib/triggerJob.js";

export const jobId = "pms-equipment-testing-reminders";
export const apiPath = "/api/cron/pms/equipment-testing-reminders";
export const schedule = "15 6 * * *";
export const description =
  "PMS — equipment testing reminders (30d / 15d before nextTestDate, UTC)";

export async function run(config) {
  return triggerJob({
    baseUrl: config.baseUrl,
    cronSecret: config.cronSecret,
    path: apiPath,
    jobId,
  });
}
