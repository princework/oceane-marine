import { getConfig } from "./lib/config.js";
import { allJobs } from "./jobs/registry.js";

const runAll = process.argv.includes("--all");
const jobIdArg = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"));

async function main() {
  const config = getConfig();

  if (runAll) {
    for (const job of allJobs) {
      console.log("---", job.jobId);
      const r = await job.run(config);
      console.log(r.ok ? JSON.stringify(r.body, null, 2) : r);
    }
    return;
  }

  if (!jobIdArg) {
    console.log("Usage: node src/run-once.js <jobId>");
    console.log("       node src/run-once.js --all");
    console.log("jobIds:", allJobs.map((j) => j.jobId).join(", "));
    process.exit(1);
  }

  const job = allJobs.find((j) => j.jobId === jobIdArg);
  if (!job) {
    console.error("Unknown jobId:", jobIdArg);
    process.exit(1);
  }

  const r = await job.run(config);
  console.log(r.ok ? JSON.stringify(r.body, null, 2) : r);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
