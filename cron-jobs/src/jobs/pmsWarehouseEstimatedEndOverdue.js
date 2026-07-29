import { triggerJob } from "../lib/triggerJob.js";

export const jobId = "pms-warehouse-estimated-end-overdue";
export const apiPath = "/api/cron/pms/warehouse-estimated-end-overdue";
export const schedule = "20 6 * * *";
export const description = "PMS — warehouse estimated end overdue notifications";

export async function run(config) {
  return triggerJob({
    baseUrl: config.baseUrl,
    cronSecret: config.cronSecret,
    path: apiPath,
    jobId,
  });
}
