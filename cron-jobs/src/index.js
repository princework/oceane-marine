import cron from "node-cron";
import { getConfig } from "./lib/config.js";
import { allJobs } from "./jobs/registry.js";

function log(jobId, msg, extra) {
  const ts = new Date().toISOString();
  if (extra !== undefined && extra !== "") {
    console.log(`[${ts}] [${jobId}] ${msg}`, extra);
  } else {
    console.log(`[${ts}] [${jobId}] ${msg}`);
  }
}

async function runWrapped(job, config) {
  log(job.jobId, "start", job.description);
  const result = await job.run(config);
  if (result.ok) {
    log(job.jobId, "ok", `status=${result.status}`);
  } else {
    console.error(`[${job.jobId}] FAIL`, result.error, result.body);
  }
}

const config = getConfig();

for (const job of allJobs) {
  cron.schedule(
    job.schedule,
    () => {
      runWrapped(job, config).catch((e) => console.error(`[${job.jobId}] unhandled`, e));
    },
    { timezone: config.timezone }
  );
  log(
    job.jobId,
    `scheduled (${config.timezone})`,
    `${job.schedule} → ${config.baseUrl}${job.apiPath}`
  );
}

console.log(`Oceane-Marine cron runner: ${allJobs.length} jobs, Ctrl+C to stop.`);
