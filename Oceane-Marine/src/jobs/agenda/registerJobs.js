import { getAgenda } from "./agenda.js";
import { defineOpsOfd001Job } from "../definitions/ops-ofd-001.job.js";
import { defineOpsOfd001AJob } from "../definitions/ops-ofd-001a.job.js";
import { defineOpsOfd002Job } from "../definitions/ops-ofd-002.job.js";
import { defineOpsOfd003Job } from "../definitions/ops-ofd-003.job.js";
import { defineOpsOfd004Job } from "../definitions/ops-ofd-004.job.js";
import { defineOpsOfd005Job } from "../definitions/ops-ofd-005.job.js";
import { defineOpsOfd005bJob } from "../definitions/ops-ofd-005b.job.js";
import { defineOpsOfd005CJob } from "../definitions/ops-ofd-005c.job.js";
import { defineOpsOfd005DJob } from "../definitions/ops-ofd-005d.job.js";
import { defineDeclarationOfSeaJob } from "../definitions/declaration-of-sea.job.js";
import { defineOpsOfd028Job } from "../definitions/ops-ofd-028.job.js";
import { defineOpsOfd009Job } from "../definitions/ops-ofd-009.job.js";
import { defineOpsOfd011Job } from "../definitions/ops-ofd-011.job.js";
import { defineOpsOfd014Job } from "../definitions/ops-ofd-014.job.js";
import { defineOpsOfd015Job } from "../definitions/ops-ofd-015.job.js";
import { defineOpsOfd018Job } from "../definitions/ops-ofd-018.job.js";
import { defineOpsOfd029Job } from "../definitions/ops-ofd-029.job.js";
import { defineOpsOfd020Job } from "../definitions/ops-ofd-020.job.js";
import { defineOpsOfd023Job } from "../definitions/ops-ofd-023.job.js";

export async function registerJobs() {
  const agenda = await getAgenda();

  defineOpsOfd001Job(agenda);
  defineOpsOfd001AJob(agenda);
  defineOpsOfd002Job(agenda);
  defineOpsOfd003Job(agenda);
  defineOpsOfd004Job(agenda);
  defineOpsOfd005Job(agenda);
  defineOpsOfd005bJob(agenda);
  defineOpsOfd005CJob(agenda);
  defineOpsOfd005DJob(agenda);
  defineDeclarationOfSeaJob(agenda);
  defineOpsOfd028Job(agenda);
  defineOpsOfd009Job(agenda);
  defineOpsOfd011Job(agenda);
  defineOpsOfd014Job(agenda);
  defineOpsOfd015Job(agenda);
  defineOpsOfd018Job(agenda);
  defineOpsOfd029Job(agenda);
  defineOpsOfd020Job(agenda);
  defineOpsOfd023Job(agenda);
  console.log("✅ Jobs Registered");
}
