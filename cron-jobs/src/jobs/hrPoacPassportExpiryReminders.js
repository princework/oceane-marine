import { triggerJob } from "../lib/triggerJob.js";

export const jobId = "hr-poac-passport-expiry-reminders";
export const apiPath = "/api/cron/hr/poac-passport-expiry-reminders";
/** Daily 06:10 in CRON_TZ (default UTC) — staggered after CID (06:00) and statutory (06:05) */
export const schedule = "10 6 * * *";
export const description =
  "HR — POAC Passport + Master's COC + Medicals: 5d before expiry + 1d after expired (UTC day)";

export async function run(config) {
  return triggerJob({
    baseUrl: config.baseUrl,
    cronSecret: config.cronSecret,
    path: apiPath,
    jobId,
  });
}
