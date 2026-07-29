import { triggerJob } from "../lib/triggerJob.js";

export const jobId = "sharepoint-sync-hr";
export const apiPath = "/api/cron/sharepoint/sync?moduleKey=hr";
export const schedule = "0 1 * * *"; // daily 01:00
export const description = "SharePoint auto-sync — HR (Oil Majors + Statutory Certificates)";

export async function run(config) {
  return triggerJob({ baseUrl: config.baseUrl, cronSecret: config.cronSecret, path: apiPath, jobId });
}
