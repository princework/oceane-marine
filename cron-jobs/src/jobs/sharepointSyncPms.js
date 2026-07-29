import { triggerJob } from "../lib/triggerJob.js";

export const jobId = "sharepoint-sync-pms";
export const apiPath = "/api/cron/sharepoint/sync?moduleKey=pms";
export const schedule = "0 2 * * *"; // daily 02:00
export const description = "SharePoint auto-sync — PMS (Equipment Inventory + Certificates + Fender Maintenance)";

export async function run(config) {
  return triggerJob({ baseUrl: config.baseUrl, cronSecret: config.cronSecret, path: apiPath, jobId });
}
