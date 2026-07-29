import { triggerJob } from "../lib/triggerJob.js";

export const jobId = "sharepoint-sync-operations";
export const apiPath = "/api/cron/sharepoint/sync?moduleKey=operations";
export const schedule = "0 4 * * *"; // daily 04:00 (largest module — runs last)
export const description = "SharePoint auto-sync — Operations (Z - Operations, year-wise)";

export async function run(config) {
  return triggerJob({ baseUrl: config.baseUrl, cronSecret: config.cronSecret, path: apiPath, jobId });
}
