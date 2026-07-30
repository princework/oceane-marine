import { triggerJob } from "../lib/triggerJob.js";

export const jobId = "operations-lined-up-to-inprogress";
export const apiPath = "/api/cron/operations/lined-up-to-inprogress";
export const schedule = "*/15 * * * *";
export const description =
  "Operations — flip Lined Up operations to In Progress once their start date/time arrives";

export async function run(config) {
  return triggerJob({
    baseUrl: config.baseUrl,
    cronSecret: config.cronSecret,
    path: apiPath,
    jobId,
  });
}
