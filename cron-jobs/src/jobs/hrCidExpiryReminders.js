import { triggerJob } from "../lib/triggerJob.js";

export const jobId = "hr-cid-expiry-reminders";
export const apiPath = "/api/cron/hr/cid-expiry-reminders";
/** Daily 06:00 in CRON_TZ (default UTC) */
export const schedule = "0 6 * * *";
export const description = "HR — CID expiry reminders (5 days before validity, UTC day)";

export async function run(config) {
  return triggerJob({
    baseUrl: config.baseUrl,
    cronSecret: config.cronSecret,
    path: apiPath,
    jobId,
  });
}
