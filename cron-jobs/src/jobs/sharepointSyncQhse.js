import { triggerJob } from "../lib/triggerJob.js";

export const jobId = "sharepoint-sync-qhse";
export const apiPath = "/api/cron/sharepoint/sync?moduleKey=qhse";
export const schedule = "0 3 * * *"; // daily 03:00
export const description = "SharePoint auto-sync — QHSE (Quality + Health & Safety)";

export async function run(config) {
  return triggerJob({ baseUrl: config.baseUrl, cronSecret: config.cronSecret, path: apiPath, jobId });
}
