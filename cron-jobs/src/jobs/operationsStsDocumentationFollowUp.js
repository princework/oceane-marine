import { triggerJob } from "../lib/triggerJob.js";

export const jobId = "operations-sts-documentation-follow-up";
export const apiPath = "/api/cron/operations/sts-documentation-follow-up";
export const schedule = "10 6 * * *";
export const description =
  "Operations — STS documentation follow-up (in-progress / completed missing docs)";

export async function run(config) {
  return triggerJob({
    baseUrl: config.baseUrl,
    cronSecret: config.cronSecret,
    path: apiPath,
    jobId,
  });
}
