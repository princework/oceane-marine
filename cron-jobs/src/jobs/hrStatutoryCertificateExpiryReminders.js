import { triggerJob } from "../lib/triggerJob.js";

export const jobId = "hr-statutory-certificate-expiry-reminders";
export const apiPath = "/api/cron/hr/statutory-certificate-expiry-reminders";
export const schedule = "5 6 * * *";
export const description =
  "HR — statutory certificates 30d / 15d before validity (UTC)";

export async function run(config) {
  return triggerJob({
    baseUrl: config.baseUrl,
    cronSecret: config.cronSecret,
    path: apiPath,
    jobId,
  });
}
